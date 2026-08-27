// Appwrite Media Provider for openGym.
//
// Resolves exercise images and animations:
// - imageUrl: returns the bundled local asset path (packaged in APK) for instant offline display.
// - gifUrl: returns the remote Appwrite Storage view URL.
// - resolveGif: resolves local cache URI or downloads over WiFi with LRU budget enforcement.

import { createGifCache } from './gifCache.js'

export const BUCKET_ID = 'exercises'

export function createAppwriteMediaProvider(options = {}) {
  const endpoint =
    options.endpoint ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APPWRITE_ENDPOINT) ||
    ''
  const projectId =
    options.projectId ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APPWRITE_PROJECT_ID) ||
    ''
  const bucketId =
    options.bucketId ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APPWRITE_BUCKET_ID) ||
    BUCKET_ID

  const cache = options.cache || createGifCache(options)

  const checkNetworkStatus = async () => {
    if (options.network) {
      try {
        const s = await options.network.getStatus()
        return s
      } catch {
        return { connected: true, connectionType: 'wifi' }
      }
    }
    if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
      try {
        const { Network } = await import('@capacitor/network')
        const s = await Network.getStatus()
        return s
      } catch {
        return { connected: true, connectionType: 'unknown' }
      }
    }
    return { connected: typeof navigator !== 'undefined' ? (navigator.onLine ?? true) : true, connectionType: 'wifi' }
  }

  const getFileId = (idOrEx, ext = 'gif') => {
    if (!idOrEx) return ''
    if (typeof idOrEx === 'object') {
      const filename = ext === 'jpg' ? (idOrEx.img || idOrEx.jpg || idOrEx.id) : (idOrEx.gif || idOrEx.video || idOrEx.id)
      return String(filename || '').replace(/\.[a-zA-Z0-9]+$/, '')
    }
    return String(idOrEx).replace(/\.[a-zA-Z0-9]+$/, '')
  }

  const getFileName = (idOrEx, ext) => {
    if (!idOrEx) return ''
    if (typeof idOrEx === 'object') {
      const prop = ext === 'jpg' ? (idOrEx.img || idOrEx.jpg) : (idOrEx.gif || idOrEx.video)
      if (prop) return prop
      if (idOrEx.id) return `${idOrEx.id}.${ext}`
    }
    const str = String(idOrEx)
    return str.endsWith(`.${ext}`) ? str : `${str}.${ext}`
  }

  return {
    supportsGifCache: true,

    imageUrl(idOrEx) {
      if (!idOrEx) return ''
      const filename = getFileName(idOrEx, 'jpg')
      return `img/${filename}`
    },

    gifUrl(idOrEx) {
      if (!idOrEx) return ''
      const fileId = getFileId(idOrEx, 'gif')
      if (endpoint && projectId && bucketId) {
        return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${projectId}`
      }
      const filename = getFileName(idOrEx, 'gif')
      return `gif/${filename}`
    },

    async resolveGif(ex, opts = {}) {
      if (!ex) return null
      const fileId = getFileId(ex, 'gif')
      if (!fileId) return null
      const url = this.gifUrl(ex)

      // A plain web browser has no device cache to populate and no Capacitor network plugin
      // to consult, so it just uses the Storage URL. `isNative` is overridable so tests can
      // exercise the device path explicitly, instead of the branch keying off whether a
      // mock happened to be injected.
      const isNative = options.isNative ?? (typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.())
      if (!isNative) {
        return url
      }

      // 1. Check local device cache first
      try {
        const cached = await cache.get(fileId)
        if (cached) return cached
      } catch { /* proceed */ }

      // 2. Check network connection and permissions safely
      let isCellular = false
      try {
        const status = await checkNetworkStatus()
        isCellular = status?.connectionType === 'cellular'
      } catch {
        isCellular = false
      }

      // Only block if we are CERTAIN we are on cellular and cellular downloads are disabled
      if (isCellular && !opts.forceDownload && !opts.allowCellular) {
        return null // Stay on static JPG to save user's mobile data plan
      }

      if (!url) return null

      // 3. Download from Storage bucket and cache
      try {
        const fetchFn = options.fetch || globalThis.fetch
        const res = await fetchFn(url)
        if (!res.ok) return url

        let base64Data = ''
        let byteSize = 0

        if (typeof res.arrayBuffer === 'function') {
          const buffer = await res.arrayBuffer()
          byteSize = buffer.byteLength
          if (typeof Buffer !== 'undefined') {
            base64Data = Buffer.from(buffer).toString('base64')
          } else {
            let binary = ''
            const bytes = new Uint8Array(buffer)
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i])
            }
            base64Data = btoa(binary)
          }
        } else if (typeof res.text === 'function') {
          base64Data = await res.text()
          byteSize = base64Data.length
        }

        if (!base64Data) return url

        // 4. Save to device cache and return URI
        const savedUri = await cache.put(fileId, base64Data, byteSize)
        return savedUri || url
      } catch {
        return url
      }
    },

    async getCacheUsage() {
      return cache.usage()
    },

    async clearCache() {
      return cache.clear()
    },
  }
}
