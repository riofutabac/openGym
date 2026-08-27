import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore, DEF, hasData } from './useStore.js'
import { createLocalAdapter } from '../lib/backend/local.js'
import { auth, state as stateRepo } from '../lib/backend/index.js'

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
      expect(useStore.getState().ready).toBe(true)
    })

    it('boot() requires account on mobile / Appwrite when no session exists', async () => {
      vi.spyOn(auth, 'currentUser').mockResolvedValue(null)
      vi.spyOn(stateRepo, 'load').mockResolvedValue(null)

      await useStore.getState().boot()

      expect(useStore.getState().user).toBeNull()
      expect(useStore.getState().isGuest()).toBe(false)
      expect(useStore.getState().ready).toBe(true)
    })

    it('boot() authenticates user when session exists', async () => {
      vi.spyOn(auth, 'currentUser').mockResolvedValue({
        id: 'u_appwrite_1',
        name: 'Alex',
        email: 'alex@example.com',
        admin: false,
      })
      vi.spyOn(stateRepo, 'load').mockResolvedValue(null)

      await useStore.getState().boot()

      expect(useStore.getState().user).toEqual({
        id: 'u_appwrite_1',
        name: 'Alex',
        email: 'alex@example.com',
        admin: false,
      })
      expect(useStore.getState().isGuest()).toBe(false)
      expect(useStore.getState().ready).toBe(true)
    })
  })

  describe('Appwrite Per-Session Row Sync & Merging', () => {
    it('merges remote workouts with local workouts by id without losing history', async () => {
      useStore.setState({
        user: { id: 'u_sync_test', name: 'Sync User' },
        S: {
          ...JSON.parse(JSON.stringify(DEF)),
          _ts: 1000,
          routines: [{ id: 'r1', name: 'Local Routine' }],
          workouts: [
            { id: 'w_local_1', d: '2026-03-01', start: 100, name: 'Local Only', entries: [] },
            { id: 'w_shared_1', d: '2026-03-02', start: 200, name: 'Shared', entries: [] },
          ],
        },
      })

      const mockDomainRepo = {
        supportsPerSessionRows: true,
        loadProfile: vi.fn().mockResolvedValue({
          ts: 2000,
          settings: { unit: 'lb' },
          routines: [{ id: 'r2', name: 'Remote Routine' }],
          week: {},
          dayPlan: {},
          exWeights: {},
          customEx: [],
          bodyweight: [],
        }),
        listWorkouts: vi.fn().mockResolvedValue([
          { id: 'w_shared_1', d: '2026-03-02', start: 200, name: 'Shared', entries: [] },
          { id: 'w_remote_2', d: '2026-03-03', start: 300, name: 'Remote Only', entries: [] },
        ]),
        saveWorkout: vi.fn().mockResolvedValue(undefined),
        saveProfile: vi.fn().mockResolvedValue(undefined),
      }

      Object.assign(stateRepo, mockDomainRepo)

      await useStore.getState().pullState()

      const currentS = useStore.getState().S

      expect(currentS.unit).toBe('lb')
      expect(currentS.routines).toEqual([{ id: 'r2', name: 'Remote Routine' }])

      expect(currentS.workouts.length).toBe(3)
      const ids = currentS.workouts.map(w => w.id)
      expect(ids).toContain('w_local_1')
      expect(ids).toContain('w_shared_1')
      expect(ids).toContain('w_remote_2')

      expect(mockDomainRepo.saveWorkout).toHaveBeenCalledWith('u_sync_test', expect.objectContaining({ id: 'w_local_1' }))
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

      // Pull state to register existing synced workouts
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

  describe('Sync and gym_dirty flag handling', () => {
    it('sets gym_dirty = "1" when signed in and pullState fails to push newer local state offline', async () => {
      useStore.setState({
        user: { id: 'u1', name: 'User 1' },
        S: { ...JSON.parse(JSON.stringify(DEF)), _ts: 200, workouts: [{ d: '2026-01-01', entries: [] }] },
      })

      stateRepo.supportsPerSessionRows = false
      vi.spyOn(stateRepo, 'load').mockResolvedValue(null)
      vi.spyOn(stateRepo, 'save').mockRejectedValue(new Error('Network error'))

      expect(globalThis.localStorage.getItem('gym_dirty')).toBeNull()

      await useStore.getState().pullState()

      expect(globalThis.localStorage.getItem('gym_dirty')).toBe('1')
    })

    it('clears gym_dirty when pushState succeeds', async () => {
      globalThis.localStorage.setItem('gym_dirty', '1')
      useStore.setState({
        user: { id: 'u1', name: 'User 1' },
        S: { ...JSON.parse(JSON.stringify(DEF)), _ts: 200, workouts: [{ d: '2026-01-01', entries: [] }] },
      })

      stateRepo.supportsPerSessionRows = false
      vi.spyOn(stateRepo, 'save').mockResolvedValue(undefined)

      await useStore.getState().pushState()

      expect(globalThis.localStorage.getItem('gym_dirty')).toBeNull()
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
