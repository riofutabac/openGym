import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAppwriteAdapter } from './appwrite.js'
import { runContractTests } from './contract.test.js'

// Mock Account service for Appwrite
function createMockAccount() {
  let session = null
  let users = new Map()

  return {
    async get() {
      if (!session) {
        const err = new Error('User (role: guests) missing scope (account)')
        err.code = 401
        throw err
      }
      return session
    },

    async create(userId, email, password, name) {
      if (users.has(email)) {
        const err = new Error('A user with the same email already exists')
        err.code = 409
        throw err
      }
      const user = { $id: userId, email, name }
      users.set(email, { ...user, password })
      return user
    },

    async createEmailPasswordSession(email, password) {
      const u = users.get(email)
      if (!u || u.password !== password) {
        const err = new Error('Invalid credentials. Please check the email and password.')
        err.code = 401
        throw err
      }
      session = { $id: u.$id, email: u.email, name: u.name }
      return { $id: 'session_' + Date.now(), userId: u.$id }
    },

    async createSession(userId, secret) {
      if (secret === 'invalid_secret') {
        const err = new Error('Invalid OAuth secret')
        err.code = 401
        throw err
      }
      const u = [...users.values()].find(x => x.$id === userId) || { $id: userId, email: 'oauth@example.com', name: 'OAuth User' }
      session = { $id: u.$id, email: u.email, name: u.name }
      return { $id: 'oauth_session_' + Date.now(), userId: u.$id }
    },

    async deleteSession(sessionId) {
      if (sessionId === 'current' || session) {
        session = null
      }
    },

    async deleteSessions() {
      session = null
    },

    createOAuth2Session(provider, success, failure) {
      return `https://cloud.appwrite.io/v1/account/sessions/oauth2/${provider}?success=${encodeURIComponent(
        success
      )}&failure=${encodeURIComponent(failure)}`
    },

    _reset() {
      session = null
      users.clear()
    },

    _setSession(s) {
      session = s
    },
  }
}

describe('Appwrite Adapter', () => {
  let mockAccount

  beforeEach(() => {
    mockAccount = createMockAccount()
  })

  // 1. Run standard conformance contract suite
  runContractTests(
    'Appwrite Adapter (Mocked SDK)',
    () => {
      mockAccount = createMockAccount()
      mockAccount._setSession({ $id: 'usr_contract', name: 'Contract User', email: 'test@example.com' })
      return createAppwriteAdapter({
        account: mockAccount,
        projectId: 'test_project',
        ID: { unique: () => 'uid_' + Math.random().toString(36).slice(2) },
      })
    },
    () => {
      mockAccount?._reset()
    }
  )

  // 2. Appwrite specific auth unit tests
  describe('Email & Password Auth', () => {
    it('registers a new user and establishes session', async () => {
      const adapter = createAppwriteAdapter({
        account: mockAccount,
        projectId: 'test_proj',
        ID: { unique: () => 'usr_123' },
      })

      const user = await adapter.auth.register('alex@example.com', 'strongpassword123', 'Alex')
      expect(user).toEqual({
        id: 'usr_123',
        name: 'Alex',
        email: 'alex@example.com',
        guest: false,
        admin: false,
      })

      const current = await adapter.auth.currentUser()
      expect(current).toEqual(user)
    })

    it('attaches HTTP status code on registration conflict', async () => {
      const adapter = createAppwriteAdapter({
        account: mockAccount,
        projectId: 'test_proj',
        ID: { unique: () => 'usr_123' },
      })

      await adapter.auth.register('duplicate@example.com', 'pass123', 'First')

      await expect(
        adapter.auth.register('duplicate@example.com', 'pass123', 'Second')
      ).rejects.toMatchObject({
        status: 409,
      })
    })

    it('logs in with email and password', async () => {
      const adapter = createAppwriteAdapter({
        account: mockAccount,
        projectId: 'test_proj',
        ID: { unique: () => 'usr_456' },
      })

      await adapter.auth.register('dan@example.com', 'password456', 'Dan')
      await adapter.auth.logout()

      expect(await adapter.auth.currentUser()).toBeNull()

      const loggedIn = await adapter.auth.loginWithEmail('dan@example.com', 'password456')
      expect(loggedIn.id).toBe('usr_456')
      expect(loggedIn.email).toBe('dan@example.com')
    })

    it('attaches 401 status on invalid credentials', async () => {
      const adapter = createAppwriteAdapter({
        account: mockAccount,
        projectId: 'test_proj',
      })

      await expect(
        adapter.auth.loginWithEmail('nobody@example.com', 'wrongpassword')
      ).rejects.toMatchObject({
        status: 401,
      })
    })
  })

  describe('Session invalidation error propagation', () => {
    it('propagates error from logoutEverywhere without swallowing', async () => {
      mockAccount.deleteSessions = async () => {
        const err = new Error('Network timeout')
        err.code = 504
        throw err
      }

      const adapter = createAppwriteAdapter({
        account: mockAccount,
        projectId: 'test_proj',
      })

      await expect(adapter.auth.logoutEverywhere()).rejects.toMatchObject({
        message: 'Network timeout',
        status: 504,
      })
    })

    it('swallows error from regular logout when offline', async () => {
      mockAccount.deleteSession = async () => {
        throw new Error('Offline')
      }

      const adapter = createAppwriteAdapter({
        account: mockAccount,
        projectId: 'test_proj',
      })

      await expect(adapter.auth.logout()).resolves.toBeUndefined()
    })
  })

  describe('Offline session survival', () => {
    // Verified on device: with no connection the app sent the user back to the
    // login screen even though the session was alive — reconnecting then failed
    // with 409 "session is active". A network failure is not a missing session.
    it('keeps the last known user when the network fails', async () => {
      const store = new Map()
      let online = true
      const account = {
        async get() {
          if (!online) throw new TypeError('Failed to fetch')
          return { $id: 'u1', email: 'a@b.com', name: 'Alex' }
        },
      }
      const adapter = createAppwriteAdapter({ account, projectId: 'p', storage: store })

      expect((await adapter.auth.currentUser())?.id).toBe('u1')

      online = false
      const offline = await adapter.auth.currentUser()
      expect(offline?.id).toBe('u1')
    })

    it('returns null when the server says the session is gone', async () => {
      const store = new Map()
      store.set('gym_appwrite_user', JSON.stringify({ id: 'stale', name: 'Stale' }))
      const account = {
        async get() {
          const err = new Error('missing scope (account)')
          err.code = 401
          throw err
        },
      }
      const adapter = createAppwriteAdapter({ account, projectId: 'p', storage: store })

      expect(await adapter.auth.currentUser()).toBeNull()
    })

    it('recovers the active session instead of failing with 409', async () => {
      const account = {
        async get() {
          return { $id: 'u1', email: 'a@b.com', name: 'Alex' }
        },
        async createEmailPasswordSession() {
          const err = new Error('Creation of a session is prohibited when a session is active.')
          err.code = 409
          throw err
        },
      }
      const adapter = createAppwriteAdapter({ account, projectId: 'p', storage: new Map() })

      const user = await adapter.auth.loginWithEmail('a@b.com', 'pw')
      expect(user.id).toBe('u1')
    })
  })

  describe('Sign-out clears the offline fallback', () => {
    it('does not let a signed-out user back in while offline', async () => {
      const store = new Map()
      let online = true
      const account = {
        async get() {
          if (!online) throw new TypeError('Failed to fetch')
          return { $id: 'u1', email: 'a@b.com', name: 'Alex' }
        },
        async deleteSession() { return {} },
      }
      const adapter = createAppwriteAdapter({ account, projectId: 'p', storage: store })

      await adapter.auth.currentUser()
      await adapter.auth.logout()

      online = false
      expect(await adapter.auth.currentUser()).toBeNull()
    })
  })

  describe('OAuth Flow and Deep Links', () => {
    it('opens system browser with properly formed OAuth token URL on native platform', async () => {
      const openSpy = vi.fn().mockResolvedValue(undefined)
      const mockBrowser = { open: openSpy, close: vi.fn() }

      // Mock Capacitor native environment
      globalThis.window = globalThis.window || {}
      globalThis.window.Capacitor = { isNativePlatform: () => true }

      const adapter = createAppwriteAdapter({
        account: mockAccount,
        endpoint: 'https://cloud.appwrite.io/v1',
        projectId: 'opengym_123',
        browser: mockBrowser,
      })

      await adapter.auth.loginWithOAuth('google')

      expect(openSpy).toHaveBeenCalledTimes(1)
      const callArg = openSpy.mock.calls[0][0]
      // Must use /account/tokens/oauth2/ so query contains userId and secret on return
      expect(callArg.url).toContain('https://cloud.appwrite.io/v1/account/tokens/oauth2/google')
      expect(callArg.url).toContain('project=opengym_123')
      expect(callArg.url).toContain(encodeURIComponent('appwrite-callback-opengym_123://auth'))

      delete globalThis.window.Capacitor
    })

    it('completes OAuth session from deep link callback and closes browser', async () => {
      const closeSpy = vi.fn().mockResolvedValue(undefined)
      const mockBrowser = { open: vi.fn(), close: closeSpy }

      const adapter = createAppwriteAdapter({
        account: mockAccount,
        projectId: 'opengym_123',
        browser: mockBrowser,
      })

      const user = await adapter.auth.handleOAuthCallback(
        'appwrite-callback-opengym_123://auth?userId=usr_oauth_77&secret=valid_oauth_secret'
      )

      expect(user).toEqual({
        id: 'usr_oauth_77',
        name: 'OAuth User',
        email: 'oauth@example.com',
        guest: false,
        admin: false,
      })
      expect(closeSpy).toHaveBeenCalledTimes(1)
    })
  })
})
