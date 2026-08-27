// Local backend adapter for openGym.
//
// Unifies mobile (Capacitor native filesystem mirror) and demo / browser guest storage.
// In mobile mode, state is mirrored to a durable JSON file in the app's data directory
// so it survives WebView localStorage eviction. In demo/browser guest mode, state lives
// in localStorage.
//
// This adapter conforms to BackendAdapter without making network calls.

const DEFAULT_KEY = 'gym_state_v1'
const FILE = 'opengym-state.json'

const IMG_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_IMG_BASE) || 'img/'
const GIF_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GIF_BASE) || 'gif/'
const IS_MOBILE_ENV = typeof import.meta !== 'undefined' && import.meta.env?.VITE_MOBILE === '1'
const IS_DEMO_ENV = typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEMO === '1'

export function createLocalAdapter(options = {}) {
  const isMobile = options.mockCapacitor !== undefined ? options.mockCapacitor : IS_MOBILE_ENV
  const isDemo = options.mockDemo !== undefined ? options.mockDemo : IS_DEMO_ENV
  const storageKey = options.storageKey || DEFAULT_KEY

  // In-memory fallback if localStorage is unavailable (e.g. node test environments)
  const memoryFallback = new Map()

  const getStorageItem = (key) => {
    try {
      if (options.storage?.getItem) return options.storage.getItem(key)
      if (typeof localStorage !== 'undefined' && localStorage.getItem) {
        return localStorage.getItem(key)
      }
    } catch { /* ignore */ }
    return memoryFallback.get(key) || null
  }

  const setStorageItem = (key, val) => {
    try {
      if (options.storage?.setItem) {
        options.storage.setItem(key, val)
        return
      }
      if (typeof localStorage !== 'undefined' && localStorage.setItem) {
        localStorage.setItem(key, val)
        return
      }
    } catch { /* ignore */ }
    memoryFallback.set(key, val)
  }

  const removeStorageItem = (key) => {
    try {
      if (options.storage?.removeItem) {
        options.storage.removeItem(key)
        return
      }
      if (typeof localStorage !== 'undefined' && localStorage.removeItem) {
        localStorage.removeItem(key)
        return
      }
    } catch { /* ignore */ }
    memoryFallback.delete(key)
  }

  const readNative = async () => {
    if (options.readFile) {
      try {
        const res = await options.readFile()
        return typeof res.data === 'string' ? JSON.parse(res.data) : res.data
      } catch {
        return null
      }
    }
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
      const r = await Filesystem.readFile({ path: FILE, directory: Directory.Data, encoding: Encoding.UTF8 })
      return JSON.parse(r.data)
    } catch {
      return null
    }
  }

  const writeNative = async (state) => {
    if (options.writeFile) {
      try {
        await options.writeFile({ data: JSON.stringify(state) })
      } catch { /* ignore */ }
      return
    }
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
      await Filesystem.writeFile({
        path: FILE,
        directory: Directory.Data,
        data: JSON.stringify(state),
        encoding: Encoding.UTF8,
      })
    } catch {
      // Degrade gracefully — keep the localStorage copy
    }
  }

  return {
    api: async () => {
      throw new Error('API network calls are disabled in local backend mode')
    },

    state: {
      async load() {
        if (isMobile) {
          const nativeState = await readNative()
          if (nativeState) return nativeState
        }
        try {
          const raw = getStorageItem(storageKey)
          if (raw) return typeof raw === 'string' ? JSON.parse(raw) : raw
        } catch {
          // Ignore parse errors and return null
        }
        return null
      },

      async save(state) {
        try {
          setStorageItem(storageKey, JSON.stringify(state))
        } catch {
          // Ignore storage write failure
        }

        if (isMobile) {
          await writeNative(state)
        }
      },
    },

    auth: {
      async currentUser() {
        try {
          const raw = getStorageItem('gym_user')
          if (raw) return typeof raw === 'string' ? JSON.parse(raw) : raw
          // Guest mode is strictly restricted to DEMO builds
          if (isDemo || getStorageItem('gym_guest') === '1') {
            return { id: 'guest', name: 'Guest', guest: true }
          }
        } catch {
          return isDemo ? { id: 'guest', name: 'Guest', guest: true } : null
        }
        return null
      },

      async register(name) {
        const user = { id: 'local_' + Date.now(), name, guest: false }
        setStorageItem('gym_user', JSON.stringify(user))
        removeStorageItem('gym_guest')
        return user
      },

      async login() {
        const user = await this.currentUser()
        if (!user || user.guest) throw new Error('No local profile found')
        return user
      },

      async logout() {
        removeStorageItem('gym_user')
        removeStorageItem('gym_guest')
      },

      async logoutEverywhere() {
        await this.logout()
      },
    },

    media: {
      imageUrl(id) {
        return `${IMG_BASE}${id}.jpg`
      },
      gifUrl(id) {
        return `${GIF_BASE}${id}.gif`
      },
    },
  }
}
