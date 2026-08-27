import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore, DEF, hasData } from './useStore.js'
import { createLocalAdapter } from '../lib/backend/local.js'
import { auth, state as stateRepo } from '../lib/backend/index.js'
import { syncQueue, PROFILE_DIRTY_KEY } from './sync.js'

// Polyfill localStorage in test environment
const mockStorage = new Map()
globalThis.localStorage = {
  getItem: key => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: key => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
}

describe('useStore boot() and lifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    globalThis.localStorage.clear()
    syncQueue.clearSyncState()
    useStore.setState({
      S: JSON.parse(JSON.stringify(DEF)),
      user: null,
      ready: false,
    })
    useStore.getState().setGuest(false)
  })

  describe('Session resolution across builds', () => {
    it('initializes as guest only in DEMO mode', async () => {
      const demoAdapter = createLocalAdapter({ mockDemo: true })
      const user = await demoAdapter.auth.currentUser()
      expect(user).toEqual({ id: 'guest', name: 'Guest', guest: true })
    })

    it('returns null on fresh install in non-demo local adapter', async () => {
      const adapter = createLocalAdapter({ mockDemo: false })
      const user = await adapter.auth.currentUser()
      expect(user).toBeNull()
    })

    it('boot() marks app as guest when adapter returns guest user (DEMO build)', async () => {
      vi.spyOn(auth, 'currentUser').mockResolvedValue({ id: 'guest', name: 'Guest', guest: true })
      vi.spyOn(stateRepo, 'load').mockResolvedValue(null)

      expect(useStore.getState().isGuest()).toBe(false)
      expect(useStore.getState().user).toBeNull()

      await useStore.getState().boot()

      expect(useStore.getState().isGuest()).toBe(true)
      expect(useStore.getState().user).toBeNull()
    })

    it('boot() requires account on mobile / Appwrite when no session exists', async () => {
      vi.spyOn(auth, 'currentUser').mockResolvedValue(null)
      vi.spyOn(stateRepo, 'load').mockResolvedValue(null)

      await useStore.getState().boot()

      expect(useStore.getState().isGuest()).toBe(false)
      expect(useStore.getState().user).toBeNull()
    })

    it('boot() authenticates user when session exists', async () => {
      vi.spyOn(auth, 'currentUser').mockResolvedValue({ id: 'usr_real', name: 'Real User', email: 'real@example.com' })
      vi.spyOn(stateRepo, 'load').mockResolvedValue(null)

      await useStore.getState().boot()

      expect(useStore.getState().user).toEqual({ id: 'usr_real', name: 'Real User', email: 'real@example.com' })
      expect(useStore.getState().isGuest()).toBe(false)
    })
  })

  describe('Appwrite Per-Session Row Sync & Merging', () => {
    it('merges remote workouts with local workouts by id without losing history', async () => {
      const mockDomainRepo = {
        supportsPerSessionRows: true,
        loadProfile: vi.fn().mockResolvedValue({
          ts: 100,
          settings: { unit: 'lb' },
          routines: [{ id: 'r1', name: 'Push' }],
        }),
        listWorkouts: vi.fn().mockResolvedValue([
          { id: 'w_remote_1', d: '2026-01-01', start: 100, name: 'Remote 1', entries: [] },
          { id: 'w_remote_2', d: '2026-01-02', start: 200, name: 'Remote 2', entries: [] },
        ]),
        saveProfile: vi.fn().mockResolvedValue(undefined),
        saveWorkout: vi.fn().mockResolvedValue(undefined),
      }

      Object.assign(stateRepo, mockDomainRepo)

      useStore.setState({
        user: { id: 'u_sync_test', name: 'Sync User' },
        S: {
          ...JSON.parse(JSON.stringify(DEF)),
          _ts: 50,
          workouts: [
            { id: 'w_local_1', d: '2026-01-03', start: 300, name: 'Local 1', entries: [] },
            { id: 'w_remote_1', d: '2026-01-01', start: 100, name: 'Remote 1 (Local Copy)', entries: [] },
          ],
        },
      })

      await useStore.getState().pullState()

      const finalState = useStore.getState().S
      expect(finalState.workouts).toHaveLength(3)

      const ids = finalState.workouts.map(w => w.id)
      expect(ids).toContain('w_local_1')
      expect(ids).toContain('w_remote_1')
      expect(ids).toContain('w_remote_2')
    })

    it('pushState uploads only unsynced workouts and never includes active workout in remote profile', async () => {
      const saveWorkoutMock = vi.fn().mockResolvedValue(undefined)
      const saveProfileMock = vi.fn().mockResolvedValue(undefined)

      const mockDomainRepo = {
        supportsPerSessionRows: true,
        loadProfile: vi.fn().mockResolvedValue(null),
        listWorkouts: vi.fn().mockResolvedValue([
          { id: 'w_already_synced', d: '2026-03-01', start: 100, name: 'Old Session', entries: [] }
        ]),
        saveWorkout: saveWorkoutMock,
        saveProfile: saveProfileMock,
      }

      Object.assign(stateRepo, mockDomainRepo)

      useStore.setState({
        user: { id: 'u_push_test', name: 'Push Test' },
        S: {
          ...JSON.parse(JSON.stringify(DEF)),
          active: { name: 'Active In Progress', start: Date.now(), entries: [] },
          workouts: [
            { id: 'w_already_synced', d: '2026-03-01', start: 100, name: 'Old Session', entries: [] }
          ],
        },
      })

      // Pull state to register existing synced workouts in syncQueue
      await useStore.getState().pullState()
      saveWorkoutMock.mockClear()
      saveProfileMock.mockClear()

      // Add a newly finished workout and trigger pushState
      const newWorkout = { id: 'w_new_session', d: '2026-03-02', start: 200, name: 'New Session', entries: [] }
      useStore.getState().update(s => {
        s.workouts.push(newWorkout)
      }, false)

      await useStore.getState().pushState()

      // 1. Only the new workout was saved — NOT the already synced one
      expect(saveWorkoutMock).toHaveBeenCalledTimes(1)
      expect(saveWorkoutMock).toHaveBeenCalledWith('u_push_test', expect.objectContaining({ id: 'w_new_session' }))

      // 2. Profile was saved without active leaking into settings
      expect(saveProfileMock).toHaveBeenCalledWith('u_push_test', expect.not.objectContaining({ active: expect.anything() }))
      const profileArg = saveProfileMock.mock.calls[0][1]
      expect(profileArg.settings.active).toBeUndefined()
    })
  })

  describe('Sync and gym_profile_dirty flag handling', () => {
    it('sets gym_profile_dirty = "1" when signed in and profile fails to push offline', async () => {
      useStore.setState({
        user: { id: 'u1', name: 'User 1' },
        S: { ...JSON.parse(JSON.stringify(DEF)), _ts: 200, workouts: [{ d: '2026-01-01', entries: [] }] },
      })

      stateRepo.supportsPerSessionRows = true
      vi.spyOn(stateRepo, 'saveProfile').mockRejectedValue(new Error('Network error'))
      vi.spyOn(stateRepo, 'saveWorkout').mockResolvedValue(true)

      expect(syncQueue.isProfileDirty()).toBe(false)

      await useStore.getState().pushState()

      expect(syncQueue.isProfileDirty()).toBe(true)
      expect(globalThis.localStorage.getItem(PROFILE_DIRTY_KEY)).toBe('1')
    })

    it('sets gym_profile_dirty = "1" in pullState when pushing newer local profile fails', async () => {
      useStore.setState({
        user: { id: 'u1', name: 'User 1' },
        S: { ...JSON.parse(JSON.stringify(DEF)), _ts: 500, workouts: [{ id: 'w1', d: '2026-01-01', entries: [] }] },
      })

      stateRepo.supportsPerSessionRows = true
      vi.spyOn(stateRepo, 'loadProfile').mockResolvedValue({ ts: 100, settings: {} })
      vi.spyOn(stateRepo, 'listWorkouts').mockResolvedValue([])
      vi.spyOn(stateRepo, 'saveProfile').mockRejectedValue(new Error('Network error'))
      vi.spyOn(stateRepo, 'saveWorkout').mockResolvedValue(true)

      expect(syncQueue.isProfileDirty()).toBe(false)

      await useStore.getState().pullState()

      expect(syncQueue.isProfileDirty()).toBe(true)
      expect(globalThis.localStorage.getItem(PROFILE_DIRTY_KEY)).toBe('1')
    })

    it('clears gym_profile_dirty when pushState succeeds', async () => {
      syncQueue.setProfileDirty(true)
      useStore.setState({
        user: { id: 'u1', name: 'User 1' },
        S: { ...JSON.parse(JSON.stringify(DEF)), _ts: 200, workouts: [{ d: '2026-01-01', entries: [] }] },
      })

      stateRepo.supportsPerSessionRows = true
      vi.spyOn(stateRepo, 'saveProfile').mockResolvedValue(true)
      vi.spyOn(stateRepo, 'saveWorkout').mockResolvedValue(true)

      await useStore.getState().pushState()

      expect(syncQueue.isProfileDirty()).toBe(false)
      expect(globalThis.localStorage.getItem(PROFILE_DIRTY_KEY)).toBeNull()
    })
  })

  describe('api() behavior across adapters', () => {
    it('throws descriptive error in local adapter mode without raw fetch fallback', async () => {
      const localAdapter = createLocalAdapter()
      await expect(localAdapter.api('/api/test')).rejects.toThrow(
        'API network calls are disabled in local backend mode'
      )
    })
  })
})
