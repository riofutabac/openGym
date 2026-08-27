import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStore, DEF, hasData } from './useStore.js'
import { createLocalAdapter } from '../lib/backend/local.js'
import { createServerAdapter } from '../lib/backend/server.js'
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

      // When no active Appwrite/server session, user remains unauthenticated
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

    it('seeds the backend storage mirror when local state has data but mirror was empty', async () => {
      let savedState = null
      const customAdapter = createLocalAdapter({
        mockCapacitor: true,
        readFile: async () => {
          if (!savedState) throw new Error('File not found')
          return { data: savedState }
        },
        writeFile: async ({ data }) => {
          savedState = JSON.parse(data)
        },
      })

      // Simulate local state with workouts
      const stateWithData = {
        ...JSON.parse(JSON.stringify(DEF)),
        _ts: 100,
        workouts: [{ d: '2026-01-01', entries: [] }],
      }
      useStore.setState({ S: stateWithData })
      expect(hasData(stateWithData)).toBe(true)

      // Initial state load from mirror is null
      const initial = await customAdapter.state.load()
      expect(initial).toBeNull()

      // State save seeds the mirror
      await customAdapter.state.save(stateWithData)

      // Storage mirror now reflects seeded state
      const loaded = await customAdapter.state.load()
      expect(loaded).toEqual(stateWithData)
    })

    it('restores state from mirror when mirror has newer state', async () => {
      const remoteState = {
        ...JSON.parse(JSON.stringify(DEF)),
        _ts: 500,
        unit: 'lb',
        workouts: [{ d: '2026-02-01', entries: [] }],
      }

      const customAdapter = createLocalAdapter({
        mockCapacitor: true,
        readFile: async () => ({ data: remoteState }),
        writeFile: async () => {},
      })

      const loaded = await customAdapter.state.load()
      expect(loaded).toEqual(remoteState)
    })
  })

  describe('Sync and gym_dirty flag handling', () => {
    it('sets gym_dirty = "1" when signed in and pullState fails to push newer local state offline', async () => {
      useStore.setState({
        user: { id: 'u1', name: 'User 1' },
        S: { ...JSON.parse(JSON.stringify(DEF)), _ts: 200, workouts: [{ d: '2026-01-01', entries: [] }] },
      })

      // Server state is null or older
      vi.spyOn(stateRepo, 'load').mockResolvedValue(null)
      // Save fails (e.g. network offline)
      vi.spyOn(stateRepo, 'save').mockRejectedValue(new Error('Network error'))

      expect(globalThis.localStorage.getItem('gym_dirty')).toBeNull()

      await useStore.getState().pullState()

      // gym_dirty is correctly set to '1' so offline changes are protected against newer remote state
      expect(globalThis.localStorage.getItem('gym_dirty')).toBe('1')
    })

    it('clears gym_dirty when pushState succeeds', async () => {
      globalThis.localStorage.setItem('gym_dirty', '1')
      useStore.setState({
        user: { id: 'u1', name: 'User 1' },
        S: { ...JSON.parse(JSON.stringify(DEF)), _ts: 200, workouts: [{ d: '2026-01-01', entries: [] }] },
      })

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

    it('server adapter api() calls fetch and preserves HTTP error status', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      })

      const serverAdapter = createServerAdapter({ fetchFn: mockFetch })
      try {
        await serverAdapter.api('/api/me')
        expect.unreachable()
      } catch (e) {
        expect(e.status).toBe(401)
        expect(e.message).toBe('Unauthorized')
      }
    })
  })
})
