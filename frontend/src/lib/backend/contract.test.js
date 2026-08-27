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

      it('persists and loads state correctly', async () => {
        const sampleState = {
          _ts: 1700000000000,
          unit: 'kg',
          routines: [{ id: 'r1', name: 'Push' }],
          workouts: [{ d: '2026-01-01', entries: [] }],
        }

        await adapter.state.save(sampleState)
        const loaded = await adapter.state.load()
        expect(loaded).toEqual(sampleState)
      })

      it('overwrites previous state when saved again', async () => {
        await adapter.state.save({ _ts: 1, unit: 'kg' })
        await adapter.state.save({ _ts: 2, unit: 'lb' })
        const loaded = await adapter.state.load()
        expect(loaded).toEqual({ _ts: 2, unit: 'lb' })
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

      it('logout resolves cleanly', async () => {
        await expect(adapter.auth.logout()).resolves.toBeUndefined()
      })
    })

    describe('MediaProvider', () => {
      it('returns image and gif URLs for exercise IDs', () => {
        const img = adapter.media.imageUrl('bench_press')
        const gif = adapter.media.gifUrl('bench_press')

        expect(typeof img).toBe('string')
        expect(img.length).toBeGreaterThan(0)
        expect(typeof gif).toBe('string')
        expect(gif.length).toBeGreaterThan(0)
      })
    })
  })
}

// Instantiate contract tests for each adapter
import { createLocalAdapter } from './local.js'
import { createServerAdapter } from './server.js'

// 1. Local Adapter Contract Test
runContractTests('Local Adapter (localStorage fallback)', () => createLocalAdapter({ mockCapacitor: false }), () => {
  if (typeof localStorage !== 'undefined') {
    localStorage.clear()
  }
})

// 2. Local Adapter Contract Test (Mobile / Filesystem simulation)
{
  let virtualFile = null
  runContractTests(
    'Local Adapter (Mobile native mode)',
    () =>
      createLocalAdapter({
        mockCapacitor: true,
        readFile: async () => {
          if (virtualFile === null) throw new Error('File not found')
          return { data: virtualFile }
        },
        writeFile: async ({ data }) => {
          virtualFile = data
        },
      }),
    () => {
      virtualFile = null
      if (typeof localStorage !== 'undefined') {
        localStorage.clear()
      }
    }
  )
}

// 3. Server Adapter Contract Test (Mocked fetch)
{
  let serverDb = { state: null, user: null }
  runContractTests(
    'Server Adapter',
    () => {
      const mockFetch = async (url, opts = {}) => {
        const method = opts.method || 'GET'
        if (url === '/api/data') {
          if (method === 'GET') {
            return {
              ok: true,
              status: 200,
              json: async () => ({ state: serverDb.state }),
            }
          }
          if (method === 'PUT') {
            const body = JSON.parse(opts.body || '{}')
            serverDb.state = body.state
            return { ok: true, status: 200, json: async () => ({ ok: true }) }
          }
        }
        if (url === '/api/me') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ user: serverDb.user }),
          }
        }
        if (url === '/api/logout' || url === '/api/logout/all') {
          serverDb.user = null
          return { ok: true, status: 200, json: async () => ({ ok: true }) }
        }
        return { ok: false, status: 404, json: async () => ({ error: 'Not found' }) }
      }

      return createServerAdapter({ fetchFn: mockFetch })
    },
    () => {
      serverDb = { state: null, user: null }
    }
  )
}
