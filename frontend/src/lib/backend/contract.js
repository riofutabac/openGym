import { describe, it, expect, beforeEach } from 'vitest'

/**
 * Shared test suite that runs against any backend adapter to ensure conformance to BackendAdapter contract.
 * @param {string} name Adapter name for test naming
 * @param {() => Promise<import('./types.js').BackendAdapter> | import('./types.js').BackendAdapter} createAdapter
 * @param {() => Promise<void> | void} [resetStorage] Optional hook to clean up storage between tests
 */
export function runContractTests(name, createAdapter, resetStorage = () => {}) {
  describe(`Backend Contract Conformance: ${name}`, () => {
    let adapter

    beforeEach(async () => {
      await resetStorage()
      adapter = await createAdapter()
    })

    describe('StateRepository', () => {
      it('returns null on load() when no state has been saved', async () => {
        const state = await adapter.state.load()
        expect(state).toBeNull()
      })

      it('persists and loads state correctly via facade', async () => {
        const sampleState = {
          _ts: 1700000000000,
          unit: 'kg',
          routines: [{ id: 'r1', name: 'Push' }],
          workouts: [{ id: 'w1', d: '2026-01-01', name: 'Push', entries: [] }],
        }

        await adapter.state.save(sampleState)
        const loaded = await adapter.state.load()
        expect(loaded).toBeDefined()
        expect(loaded.unit).toBe('kg')
        expect(loaded.routines).toEqual([{ id: 'r1', name: 'Push' }])
        expect(loaded.workouts.length).toBe(1)
        expect(loaded.workouts[0].id).toBe('w1')
      })

      it('overwrites previous state when saved again', async () => {
        await adapter.state.save({ _ts: 1, unit: 'kg' })
        await adapter.state.save({ _ts: 2, unit: 'lb' })
        const loaded = await adapter.state.load()
        expect(loaded.unit).toBe('lb')
      })

      it('supports per-session row operations if capability declared', async () => {
        if (adapter.state.supportsPerSessionRows) {
          const testUid = 'user_contract_test'
          const w1 = { id: 'w_sess_1', d: '2026-03-01', start: 100, end: 200, name: 'Legs', entries: [] }
          const w2 = { id: 'w_sess_2', d: '2026-03-02', start: 300, end: 400, name: 'Chest', entries: [] }

          // Save workouts
          await adapter.state.saveWorkout(testUid, w1)
          await adapter.state.saveWorkout(testUid, w2)

          // Idempotency: saving w1 again should NOT duplicate
          await adapter.state.saveWorkout(testUid, w1)

          const list = await adapter.state.listWorkouts(testUid)
          expect(list.length).toBe(2)
          expect(list.map(w => w.id)).toContain('w_sess_1')
          expect(list.map(w => w.id)).toContain('w_sess_2')

          // Profile load/save
          const profile = {
            ts: 12345,
            settings: { unit: 'kg' },
            routines: [{ id: 'r_test', name: 'Test Routine' }],
            week: { 1: 'r_test' },
            exWeights: { bench: 80 },
            customEx: [],
            bodyweight: [{ d: '2026-03-01', w: 75.5 }],
          }
          await adapter.state.saveProfile(testUid, profile)
          const loadedProf = await adapter.state.loadProfile(testUid)
          expect(loadedProf.ts).toBe(12345)
          expect(loadedProf.settings.unit).toBe('kg')
          expect(loadedProf.routines.length).toBe(1)

          // Deletion idempotency
          await adapter.state.deleteWorkout(testUid, 'w_sess_1')
          await adapter.state.deleteWorkout(testUid, 'w_sess_1') // second deletion doesn't throw
          const afterDelete = await adapter.state.listWorkouts(testUid)
          expect(afterDelete.length).toBe(1)
          expect(afterDelete[0].id).toBe('w_sess_2')
        }
      })
    })

    describe('AuthProvider', () => {
      it('exposes standard session methods', () => {
        expect(typeof adapter.auth.currentUser).toBe('function')
        expect(typeof adapter.auth.register).toBe('function')
        expect(typeof adapter.auth.login).toBe('function')
        expect(typeof adapter.auth.logout).toBe('function')
        expect(typeof adapter.auth.logoutEverywhere).toBe('function')
      })

      it('can query current user session without throwing', async () => {
        const user = await adapter.auth.currentUser()
        expect(user === null || typeof user === 'object').toBe(true)
        if (user) {
          expect(typeof user.name).toBe('string')
        }
      })

      it('logout is idempotent and resolves cleanly', async () => {
        await expect(adapter.auth.logout()).resolves.toBeUndefined()
        await expect(adapter.auth.logout()).resolves.toBeUndefined()
      })

      it('logoutEverywhere resolves cleanly', async () => {
        await expect(adapter.auth.logoutEverywhere()).resolves.toBeUndefined()
      })

      it('supports email/password auth interface when declared', () => {
        if (adapter.auth.supportsEmailPassword) {
          expect(typeof adapter.auth.loginWithEmail).toBe('function')
        }
      })

      it('supports OAuth interface when declared', () => {
        if (adapter.auth.supportsOAuth) {
          expect(typeof adapter.auth.loginWithOAuth).toBe('function')
        }
      })
    })

    describe('MediaProvider', () => {
      it('returns image and gif URLs for exercise IDs and objects', () => {
        const imgById = adapter.media.imageUrl('bench_press')
        const gifById = adapter.media.gifUrl('bench_press')

        const imgByObj = adapter.media.imageUrl({ id: 'bench_press', img: '0001.jpg' })
        const gifByObj = adapter.media.gifUrl({ id: 'bench_press', gif: '0001.gif' })

        expect(typeof imgById).toBe('string')
        expect(imgById.length).toBeGreaterThan(0)
        expect(typeof gifById).toBe('string')
        expect(gifById.length).toBeGreaterThan(0)

        expect(typeof imgByObj).toBe('string')
        expect(imgByObj.length).toBeGreaterThan(0)
        expect(typeof gifByObj).toBe('string')
        expect(gifByObj.length).toBeGreaterThan(0)
      })

      it('declares and adheres to GIF caching capabilities when supported', async () => {
        if (adapter.media.supportsGifCache) {
          expect(typeof adapter.media.resolveGif).toBe('function')
          expect(typeof adapter.media.getCacheUsage).toBe('function')
          expect(typeof adapter.media.clearCache).toBe('function')

          const res = await adapter.media.resolveGif({ id: 'bench_press', gif: '0001.gif' })
          expect(res === null || typeof res === 'string').toBe(true)

          const usage = await adapter.media.getCacheUsage()
          expect(typeof usage.usedBytes).toBe('number')
          expect(typeof usage.count).toBe('number')
        }
      })
    })
  })
}
