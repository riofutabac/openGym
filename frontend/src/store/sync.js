// Offline Mutation Queue and Sync Drainer for openGym.
//
// Manages synchronization of workout sessions and user profile to Appwrite backend.
//
// Key design principles:
// 1. Pending is a subtraction, not a copy: pending = S.workouts minus confirmed IDs (gym_synced_v1).
//    Avoids parallel queues and duplicate sources of truth.
// 2. Pending deletions: gym_deleted_workouts_v1 (tombstones) tracks deletions to prevent pull resurrection,
//    and gym_pending_delete_v1 tracks pending cloud deletion requests.
// 3. Profile dirty state (gym_profile_dirty) is strictly separated from workout sync state.
// 4. Sequential drain: deletions and workouts are drained to ensure confirmed state is strictly accurate.
// 5. Error classification:
//    - 401: unauthorized (aborts immediately without altering pending/failed sets).
//    - 4xx (client errors): quarantined to gym_sync_failed_v1 with error message so they don't block healthy queue items.
//    - Network/5xx: remains pending for next reconnection or manual refresh.

export const SYNCED_KEY = 'gym_synced_v1'
export const FAILED_KEY = 'gym_sync_failed_v1'
export const DELETED_KEY = 'gym_deleted_workouts_v1'
export const PENDING_DELETE_KEY = 'gym_pending_delete_v1'
export const PROFILE_DIRTY_KEY = 'gym_profile_dirty'
export const LEGACY_DIRTY_KEY = 'gym_dirty'

export function createSyncQueue(options = {}) {
  const getStorage = () => options.storage || (typeof localStorage !== 'undefined' ? localStorage : null)
  let isDraining = false

  const migrateLegacy = () => {
    try {
      const storage = getStorage()
      const legacy = storage?.getItem?.(LEGACY_DIRTY_KEY)
      if (legacy !== null && legacy !== undefined) {
        storage?.setItem?.(PROFILE_DIRTY_KEY, legacy)
        storage?.removeItem?.(LEGACY_DIRTY_KEY)
      }
    } catch {
      // Ignore
    }
  }
  migrateLegacy()

  const loadJson = (key, fallback) => {
    try {
      const storage = getStorage()
      const raw = storage?.getItem?.(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') return parsed
      }
    } catch {
      // Discard corrupt storage safely
    }
    return fallback
  }

  const saveJson = (key, val) => {
    try {
      const storage = getStorage()
      storage?.setItem?.(key, JSON.stringify(val))
    } catch {
      // Ignore storage write error
    }
  }

  return {
    getSyncedIds() {
      const arr = loadJson(SYNCED_KEY, [])
      return new Set(Array.isArray(arr) ? arr : [])
    },

    setSyncedIds(ids) {
      const arr = Array.isArray(ids) ? ids : Array.from(ids || [])
      saveJson(SYNCED_KEY, arr)
    },

    markWorkoutSynced(id) {
      if (!id) return
      const synced = this.getSyncedIds()
      synced.add(String(id))
      this.setSyncedIds(synced)

      // Remove from failed map if present
      const failed = this.getFailedWorkouts()
      if (failed[id]) {
        delete failed[id]
        saveJson(FAILED_KEY, failed)
      }
    },

    markWorkoutsSynced(ids) {
      if (!ids) return
      const synced = this.getSyncedIds()
      const list = Array.isArray(ids) ? ids : Array.from(ids)
      for (const id of list) {
        if (id) synced.add(String(id))
      }
      this.setSyncedIds(synced)
    },

    getDeletedIds() {
      const arr = loadJson(DELETED_KEY, [])
      return new Set(Array.isArray(arr) ? arr : [])
    },

    setDeletedIds(ids) {
      const arr = Array.isArray(ids) ? ids : Array.from(ids || [])
      // Keep most recent 500 tombstones
      const trimmed = arr.slice(-500)
      saveJson(DELETED_KEY, trimmed)
    },

    getPendingDeleteIds() {
      const arr = loadJson(PENDING_DELETE_KEY, [])
      return new Set(Array.isArray(arr) ? arr : [])
    },

    setPendingDeleteIds(ids) {
      const arr = Array.isArray(ids) ? ids : Array.from(ids || [])
      saveJson(PENDING_DELETE_KEY, arr)
    },

    markWorkoutDeleted(id) {
      if (!id) return
      const idStr = String(id)

      // 1. Add to tombstone set (never resurrect in pullState)
      const deleted = this.getDeletedIds()
      deleted.add(idStr)
      this.setDeletedIds(deleted)

      // 2. Add to pending server deletion queue
      const pendingDelete = this.getPendingDeleteIds()
      pendingDelete.add(idStr)
      this.setPendingDeleteIds(pendingDelete)

      // 3. Remove from synced set
      const synced = this.getSyncedIds()
      if (synced.has(idStr)) {
        synced.delete(idStr)
        this.setSyncedIds(synced)
      }

      // 4. Remove from failed map
      const failed = this.getFailedWorkouts()
      if (failed[idStr]) {
        delete failed[idStr]
        saveJson(FAILED_KEY, failed)
      }
    },

    confirmWorkoutDeleted(id) {
      if (!id) return
      const idStr = String(id)
      const pendingDelete = this.getPendingDeleteIds()
      if (pendingDelete.has(idStr)) {
        pendingDelete.delete(idStr)
        this.setPendingDeleteIds(pendingDelete)
      }
    },

    getFailedWorkouts() {
      return loadJson(FAILED_KEY, {})
    },

    clearFailedWorkouts() {
      saveJson(FAILED_KEY, {})
    },

    isProfileDirty() {
      try {
        const storage = getStorage()
        return storage?.getItem?.(PROFILE_DIRTY_KEY) === '1'
      } catch {
        return false
      }
    },

    setProfileDirty(dirty) {
      try {
        const storage = getStorage()
        if (dirty) {
          storage?.setItem?.(PROFILE_DIRTY_KEY, '1')
        } else {
          storage?.removeItem?.(PROFILE_DIRTY_KEY)
        }
      } catch {
        // Ignore storage error
      }
    },

    getPendingWorkouts(workouts = [], opts = {}) {
      if (!Array.isArray(workouts)) return []
      const synced = this.getSyncedIds()
      const deleted = this.getDeletedIds()
      const failed = this.getFailedWorkouts()

      return workouts.filter((w) => {
        if (!w?.id) return false
        const idStr = String(w.id)
        if (deleted.has(idStr)) return false
        if (synced.has(idStr)) return false
        if (!opts.includeFailed && failed[idStr]) return false
        return true
      })
    },

    getPendingCount(workouts = [], opts = {}) {
      return this.getPendingWorkouts(workouts, opts).length
    },

    async drain(userId, workouts = [], stateRepo, opts = {}) {
      if (!userId || !stateRepo || isDraining) {
        return { uploaded: 0, failed: 0, skipped: true }
      }

      isDraining = true
      let uploaded = 0
      let failedCount = 0
      let stopped = false
      let unauthorized = false

      try {
        // 1. Drain pending deletions first
        const pendingDeleteIds = this.getPendingDeleteIds()
        for (const delId of pendingDeleteIds) {
          try {
            if (stateRepo.deleteWorkout) {
              await stateRepo.deleteWorkout(userId, delId)
            }
            this.confirmWorkoutDeleted(delId)
          } catch (delErr) {
            const status = delErr?.status || delErr?.code || 500
            if (status === 401) {
              unauthorized = true
              stopped = true
              break
            }
            if (status === 404) {
              this.confirmWorkoutDeleted(delId)
            }
          }
        }

        if (stopped || unauthorized) {
          return { uploaded, failed: failedCount, stopped, unauthorized }
        }

        // 2. Drain pending workouts
        const pending = this.getPendingWorkouts(workouts, { includeFailed: !!opts.includeFailed })

        for (const w of pending) {
          try {
            await stateRepo.saveWorkout(userId, w)
            this.markWorkoutSynced(w.id)
            uploaded++
          } catch (err) {
            const status = err?.status || err?.code || 500

            if (status === 401) {
              unauthorized = true
              stopped = true
              break
            }

            if (status >= 400 && status < 500) {
              const failedMap = this.getFailedWorkouts()
              failedMap[String(w.id)] = {
                msg: err.message || 'Rejected by server',
                at: Date.now(),
                status,
              }
              saveJson(FAILED_KEY, failedMap)
              failedCount++
            } else {
              stopped = true
              break
            }
          }
        }
      } finally {
        isDraining = false
      }

      return {
        uploaded,
        failed: failedCount,
        stopped,
        unauthorized,
      }
    },

    clearSyncState() {
      try {
        const storage = getStorage()
        storage?.removeItem?.(SYNCED_KEY)
        storage?.removeItem?.(FAILED_KEY)
        storage?.removeItem?.(DELETED_KEY)
        storage?.removeItem?.(PENDING_DELETE_KEY)
        storage?.removeItem?.(PROFILE_DIRTY_KEY)
        storage?.removeItem?.(LEGACY_DIRTY_KEY)
      } catch {
        // Ignore
      }
    },
  }
}

// Global singleton instance
export const syncQueue = createSyncQueue()
