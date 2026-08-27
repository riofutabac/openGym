import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSyncQueue } from './sync.js'

describe('sync.js - Offline Mutation Queue & Sync Drainer', () => {
  let storageMap
  let mockStorage
  let sync

  beforeEach(() => {
    storageMap = new Map()
    mockStorage = {
      getItem: vi.fn((k) => storageMap.get(k) || null),
      setItem: vi.fn((k, v) => storageMap.set(k, String(v))),
      removeItem: vi.fn((k) => storageMap.delete(k)),
    }
    sync = createSyncQueue({ storage: mockStorage })
  })

  it('calculates pending workouts as a set difference (S.workouts - confirmed)', () => {
    const workouts = [
      { id: 'w1', d: '2026-08-01' },
      { id: 'w2', d: '2026-08-02' },
      { id: 'w3', d: '2026-08-03' },
    ]

    expect(sync.getPendingWorkouts(workouts)).toHaveLength(3)

    sync.markWorkoutSynced('w1')
    expect(sync.getPendingWorkouts(workouts)).toEqual([
      { id: 'w2', d: '2026-08-02' },
      { id: 'w3', d: '2026-08-03' },
    ])
    expect(sync.getPendingCount(workouts)).toBe(2)
  })

  it('drains sessions one by one and records confirmed IDs sequentially', async () => {
    const workouts = [
      { id: 'w1', d: '2026-08-01' },
      { id: 'w2', d: '2026-08-02' },
      { id: 'w3', d: '2026-08-03' },
    ]

    const mockRepo = {
      saveWorkout: vi.fn().mockResolvedValue(true),
    }

    const res = await sync.drain('usr_1', workouts, mockRepo)
    expect(res.uploaded).toBe(3)
    expect(mockRepo.saveWorkout).toHaveBeenCalledTimes(3)
    expect(sync.getPendingWorkouts(workouts)).toHaveLength(0)
  })

  it('preserves confirmed workouts when a subsequent session fails due to network', async () => {
    const workouts = [
      { id: 'w1', d: '2026-08-01' },
      { id: 'w2', d: '2026-08-02' },
      { id: 'w3', d: '2026-08-03' },
    ]

    const mockRepo = {
      saveWorkout: vi.fn()
        .mockResolvedValueOnce(true) // w1 succeeds
        .mockRejectedValueOnce(new Error('Network offline')) // w2 fails on network
    }

    const res = await sync.drain('usr_1', workouts, mockRepo)
    expect(res.uploaded).toBe(1)
    expect(res.stopped).toBe(true)

    // w1 confirmed, w2 and w3 remain pending
    const pending = sync.getPendingWorkouts(workouts)
    expect(pending.map(w => w.id)).toEqual(['w2', 'w3'])
  })

  it('aborts drain immediately on 401 without marking failed or losing session state', async () => {
    const workouts = [{ id: 'w1', d: '2026-08-01' }]
    const err401 = new Error('Unauthorized')
    err401.status = 401

    const mockRepo = {
      saveWorkout: vi.fn().mockRejectedValue(err401),
    }

    const res = await sync.drain('usr_1', workouts, mockRepo)
    expect(res.uploaded).toBe(0)
    expect(res.unauthorized).toBe(true)
    expect(sync.getFailedWorkouts()).toEqual({})
    expect(sync.getPendingWorkouts(workouts)).toHaveLength(1)
  })

  it('quarantines permanent 4xx errors to failed map without blocking healthy sessions behind', async () => {
    const workouts = [
      { id: 'w_corrupt', d: '2026-08-01', entries: 'invalid' },
      { id: 'w_good', d: '2026-08-02' },
    ]

    const err400 = new Error('Document size exceeds limit')
    err400.status = 400

    const mockRepo = {
      saveWorkout: vi.fn()
        .mockRejectedValueOnce(err400) // w_corrupt fails with 400
        .mockResolvedValueOnce(true),  // w_good succeeds
    }

    const res = await sync.drain('usr_1', workouts, mockRepo)
    expect(res.uploaded).toBe(1)
    expect(res.failed).toBe(1)

    const failed = sync.getFailedWorkouts()
    expect(failed['w_corrupt']).toBeDefined()
    expect(failed['w_corrupt'].msg).toBe('Document size exceeds limit')
    expect(failed['w_corrupt'].status).toBe(400)

    // Automatic pending list skips quarantined failed item
    expect(sync.getPendingWorkouts(workouts, { includeFailed: false })).toHaveLength(0)

    // Manual refresh includes failed items to retry
    expect(sync.getPendingWorkouts(workouts, { includeFailed: true })).toEqual([workouts[0]])
  })

  it('migrates legacy gym_dirty flag to gym_profile_dirty exactly once', () => {
    storageMap.set('gym_dirty', '1')

    const newSync = createSyncQueue({ storage: mockStorage })
    expect(newSync.isProfileDirty()).toBe(true)
    expect(storageMap.has('gym_dirty')).toBe(false)
    expect(storageMap.get('gym_profile_dirty')).toBe('1')
  })

  it('prevents overlapping concurrent drain executions', async () => {
    const workouts = [{ id: 'w1', d: '2026-08-01' }]
    let resolveSave
    const mockRepo = {
      saveWorkout: vi.fn(() => new Promise((resolve) => { resolveSave = resolve })),
    }

    const p1 = sync.drain('usr_1', workouts, mockRepo)
    const p2 = sync.drain('usr_1', workouts, mockRepo) // Concurrent call

    resolveSave(true)
    const [r1, r2] = await Promise.all([p1, p2])

    expect(mockRepo.saveWorkout).toHaveBeenCalledTimes(1)
  })
})
