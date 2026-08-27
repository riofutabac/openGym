// Appwrite backend adapter for openGym.
//
// Implements AuthProvider using Appwrite Cloud (email/password and OAuth2 authentication),
// allowing openGym mobile builds to operate with durable user accounts rather than anonymous
// local files or custom server passkeys.
//
// State and media storage in this milestone delegate to local providers until Milestone 3 and 4
// migrate routines/workouts and asset files to Appwrite Databases and Storage.

import { createLocalAdapter } from './local.js'

export function createAppwriteAdapter(options = {}) {
  // No default endpoint on purpose: Appwrite Cloud is regional, and the generic
  // https://cloud.appwrite.io/v1 answers 401 "Project is not accessible in this region"
  // for a project hosted anywhere else. A wrong default fails at runtime on the device
  // with an error that does not name the cause; a missing one fails here, by name.
  const endpoint =
    options.endpoint ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APPWRITE_ENDPOINT) ||
    ''

  const projectId =
    options.projectId ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APPWRITE_PROJECT_ID) ||
    ''

  const fallbackLocal = createLocalAdapter()
  const stateRepo = options.state || fallbackLocal.state
  const mediaProvider = options.media || fallbackLocal.media

  let cachedAccount = options.account || null

  const getAccount = async () => {
    if (cachedAccount) return cachedAccount
    if (!options.client) {
      if (!projectId) throw new Error('VITE_APPWRITE_PROJECT_ID is required to initialize Appwrite')
      if (!endpoint) throw new Error('VITE_APPWRITE_ENDPOINT is required to initialize Appwrite (Cloud endpoints are regional, e.g. https://sfo.cloud.appwrite.io/v1)')
    }
    const { Client, Account } = await import('appwrite')
    const client = options.client || new Client().setEndpoint(endpoint).setProject(projectId)
    cachedAccount = new Account(client)
    return cachedAccount
  }

  const getID = async () => {
    if (options.ID) return options.ID
    const { ID } = await import('appwrite')
    return ID
  }

  const normalizeError = (err) => {
    const e = new Error(err.message || 'Authentication error')
    e.status = err.code || err.status || 500
    e.type = err.type
    return e
  }

  const mapUser = (acc) => {
    if (!acc) return null
    return {
      id: acc.$id,
      name: acc.name || acc.email?.split('@')[0] || 'User',
      email: acc.email || undefined,
      guest: false,
      admin: false,
    }
  }

  return {
    api: async () => {
      throw new Error('Direct API calls are disabled in Appwrite backend mode')
    },

    state: stateRepo,
    media: mediaProvider,

    auth: {
      supportsEmailPassword: true,
      supportsOAuth: true,

      async currentUser() {
        try {
          const account = await getAccount()
          const acc = await account.get()
          return mapUser(acc)
        } catch {
          // On 401 or offline network failure, gracefully return null
          return null
        }
      },

      async register(email, password, name) {
        try {
          const account = await getAccount()
          const ID = await getID()
          const userId = ID.unique()

          await account.create(userId, email, password, name || '')
          await account.createEmailPasswordSession(email, password)
          const acc = await account.get()
          return mapUser(acc)
        } catch (err) {
          throw normalizeError(err)
        }
      },

      async login(credentials) {
        if (credentials?.email && credentials?.password) {
          return this.loginWithEmail(credentials.email, credentials.password)
        }
        const user = await this.currentUser()
        if (!user) {
          const e = new Error('No active Appwrite session')
          e.status = 401
          throw e
        }
        return user
      },

      async loginWithEmail(email, password) {
        try {
          const account = await getAccount()
          await account.createEmailPasswordSession(email, password)
          const acc = await account.get()
          return mapUser(acc)
        } catch (err) {
          throw normalizeError(err)
        }
      },

      async loginWithOAuth(provider) {
        try {
          const isCapacitor = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()
          const origin = (typeof window !== 'undefined' && window.location?.origin) || 'https://localhost'

          let successUrl = `${origin}/`
          let failureUrl = `${origin}/#/login?error=oauth`

          if (isCapacitor && projectId) {
            successUrl = `appwrite-callback-${projectId}://auth`
            failureUrl = `appwrite-callback-${projectId}://auth/fail`
          }

          if (isCapacitor) {
            // On native Capacitor, using OAuth token endpoint (/account/tokens/oauth2/) returns
            // userId and secret query parameters to the deep link scheme, allowing createSession(userId, secret)
            // inside the app without browser cookie sharing issues or WebView disallowed_useragent blocks.
            const uri = new URL(`${endpoint}/account/tokens/oauth2/${provider}`)
            uri.searchParams.append('project', projectId)
            uri.searchParams.append('success', successUrl)
            uri.searchParams.append('failure', failureUrl)

            if (options.browser?.open) {
              await options.browser.open({ url: uri.toString() })
            } else {
              const { Browser } = await import('@capacitor/browser')
              await Browser.open({ url: uri.toString() })
            }
          } else {
            const account = await getAccount()
            account.createOAuth2Session(provider, successUrl, failureUrl)
          }
        } catch (err) {
          throw normalizeError(err)
        }
      },

      // Converts deep link parameters (userId + secret) returned by OAuth into an active Appwrite session
      async handleOAuthCallback(urlStr) {
        try {
          let userId = null
          let secret = null

          try {
            const url = new URL(urlStr)
            userId = url.searchParams.get('userId')
            secret = url.searchParams.get('secret')
          } catch {
            const qIdx = urlStr?.indexOf('?') ?? -1
            if (qIdx !== -1) {
              const params = new URLSearchParams(urlStr.slice(qIdx + 1))
              userId = params.get('userId')
              secret = params.get('secret')
            }
          }

          if (userId && secret) {
            const account = await getAccount()
            await account.createSession(userId, secret)
            try {
              if (options.browser?.close) {
                await options.browser.close()
              } else {
                const { Browser } = await import('@capacitor/browser')
                await Browser.close()
              }
            } catch { /* ignore */ }
            const acc = await account.get()
            return mapUser(acc)
          }
        } catch (err) {
          throw normalizeError(err)
        }
        return null
      },

      async logout() {
        try {
          const account = await getAccount()
          await account.deleteSession('current')
        } catch {
          // Swallow offline logout failure
        }
      },

      // Ends all sessions across devices; errors are intentionally NOT swallowed so callers
      // (useStore.signOutAll) do not clear local state if remote session invalidation failed.
      async logoutEverywhere() {
        try {
          const account = await getAccount()
          await account.deleteSessions()
        } catch (err) {
          throw normalizeError(err)
        }
      },
    },
  }
}
