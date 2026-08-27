import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAppwriteStateRepo } from './appwriteData.js'
import { runContractTests } from './contract.js'
import { createMockDatabases, mockSDK } from './testUtils.js'
import { DATABASE_ID, TABLES } from './schema.js'

describe('Appwrite State Repository', () => {
  let mockDatabases
  let mockAuth

  beforeEach(() => {
    mockDatabases = createMockDatabases()
    mockAuth = {
      currentUser: vi.fn().mockResolvedValue({ id: 'u_test_1', name: 'User 1', guest: false }),
    }
  })

  // 1. Run contract tests against composite Appwrite adapter using this state repo
  runContractTests(
    'Appwrite State Repo (Composite Facade)',
    () => {
      mockDatabases = createMockDatabases()
      const stateRepo = createAppwriteStateRepo({
        databases: mockDatabases,
        sdk: mockSDK,
        auth: {
          currentUser: async () => ({ id: 'usr_contract', name: 'Contract User', guest: false }),
        },
      })

      return {
        auth: {
          currentUser: async () => ({ id: 'usr_contract', name: 'Contract User', guest: false }),
          register: vi.fn().mockResolvedValue({ id: 'usr_contract', name: 'Contract User' }),
          login: vi.fn().mockResolvedValue({ id: 'usr_contract', name: 'Contract User' }),
          logout: vi.fn().mockResolvedValue(undefined),
          logoutEverywhere: vi.fn().mockResolvedValue(undefined),
        },
        state: stateRepo,
        media: {
          imageUrl: id => `img/${id}.jpg`,
          gifUrl: id => `gif/${id}.gif`,
        },
      }
    },
    () => {
      mockDatabases?._reset()
    }
  )

  // 2. Granular per-session and document security tests
  describe('Per-Session Workouts & Idempotency', () => {
    it('creates and lists workouts with correct document security permissions', async () => {
      const repo = createAppwriteStateRepo({
        databases: mockDatabases,
        sdk: mockSDK,
        auth: mockAuth,
      })

      const w1 = {
        id: 'w_gym_1',
        d: '2026-03-01',
        start: 1700000000,
        end: 1700003600,
        routineId: 'r_push',
        name: 'Push Day',
        bw: 80.5,
        vol: 12000,
        prs: ['bench'],
        entries: [{ ex: 'bench', sets: [{ r: 10, w: 100 }] }],
      }

      await repo.saveWorkout('u_test_1', w1)

      // Verify stored document in database
      const rawDoc = await mockDatabases.getDocument(DATABASE_ID, TABLES.WORKOUTS, 'w_gym_1')
      expect(rawDoc.$id).toBe('w_gym_1')
      expect(rawDoc.userId).toBe('u_test_1')
      expect(rawDoc.name).toBe('Push Day')

      // Check document security permissions attached for owner
      expect(rawDoc.$permissions).toContain('read("user:u_test_1")')
      expect(rawDoc.$permissions).toContain('update("user:u_test_1")')
      expect(rawDoc.$permissions).toContain('delete("user:u_test_1")')

      // List workouts
      const list = await repo.listWorkouts('u_test_1')
      expect(list.length).toBe(1)
      expect(list[0]).toEqual(w1)
    })

    it('guarantees idempotency when saveWorkout is called repeatedly with same id', async () => {
      const repo = createAppwriteStateRepo({
        databases: mockDatabases,
        sdk: mockSDK,
        auth: mockAuth,
      })

      const w = { id: 'w_duplicate_test', d: '2026-03-01', start: 100, end: 200, name: 'Legs', entries: [] }

      await repo.saveWorkout('u_test_1', w)
      await repo.saveWorkout('u_test_1', w)
      await repo.saveWorkout('u_test_1', { ...w, name: 'Legs Updated' })

      const list = await repo.listWorkouts('u_test_1')
      expect(list.length).toBe(1)
      expect(list[0].name).toBe('Legs Updated')
    })

    it('paginates across more than 100 workout sessions', async () => {
      const repo = createAppwriteStateRepo({
        databases: mockDatabases,
        sdk: mockSDK,
        auth: mockAuth,
      })

      // Insert 125 workouts
      for (let i = 1; i <= 125; i++) {
        const id = `w_${String(i).padStart(3, '0')}`
        await repo.saveWorkout('u_test_1', {
          id,
          d: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
          start: 1000 + i,
          end: 2000 + i,
          name: `Workout ${i}`,
          entries: [],
        })
      }

      const all = await repo.listWorkouts('u_test_1')
      expect(all.length).toBe(125)
    })

    it('isolates user workout rows between separate accounts', async () => {
      const repo = createAppwriteStateRepo({
        databases: mockDatabases,
        sdk: mockSDK,
      })

      await repo.saveWorkout('user_alice', { id: 'w_alice_1', d: '2026-01-01', name: 'Alice Session', entries: [] })
      await repo.saveWorkout('user_bob', { id: 'w_bob_1', d: '2026-01-01', name: 'Bob Session', entries: [] })

      const aliceWorkouts = await repo.listWorkouts('user_alice')
      const bobWorkouts = await repo.listWorkouts('user_bob')

      expect(aliceWorkouts.length).toBe(1)
      expect(aliceWorkouts[0].id).toBe('w_alice_1')

      expect(bobWorkouts.length).toBe(1)
      expect(bobWorkouts[0].id).toBe('w_bob_1')
    })
  })
})
