// LRU Animation Cache for mobile device storage
//
// Manages downloaded exercise GIFs on device storage under Directory.Cache
// with a strict 50 MB budget, least-recently-used eviction, and corrupt index resilience.

export const MAX_CACHE_BYTES = 50 * 1024 * 1024 // 50 MB
export const CACHE_INDEX_KEY = 'gym_gif_cache_index_v1'
export const CACHE_DIR = 'opengym_gifs'

let globalSeq = 0

export function createGifCache(options = {}) {
  const maxBytes = options.maxBytes || MAX_CACHE_BYTES
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null)
  let cachedFilesystem = options.filesystem || null
  let cachedDirectory = options.directory || null

  const getFilesystem = async () => {
    if (cachedFilesystem) {
      return { Filesystem: cachedFilesystem, Directory: cachedDirectory || { Cache: 'CACHE' } }
    }
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      cachedFilesystem = Filesystem
      cachedDirectory = Directory
      return { Filesystem, Directory }
    } catch {
      return null
    }
  }

  const loadIndex = () => {
    try {
      const raw = storage?.getItem?.(CACHE_INDEX_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') return parsed
      }
    } catch {
      // Discard corrupt index safely
    }
    return {}
  }

  const saveIndex = (index) => {
    try {
      storage?.setItem?.(CACHE_INDEX_KEY, JSON.stringify(index))
    } catch {
      // Ignore storage errors
    }
  }

  const sanitizeId = (id) => String(id).replace(/[^a-zA-Z0-9_-]/g, '_')

  // Filesystem.getUri hands back a file:// path, and the Android WebView refuses to load
  // one from an <img src> — the request fails silently and the UI stays on the still JPG.
  // convertFileSrc rewrites it to the WebView's own served origin, which is the only form
  // an <img> will accept. Outside Capacitor there is nothing to convert.
  const toWebUri = (uri) => {
    if (!uri) return null
    try {
      const conv = globalThis.Capacitor?.convertFileSrc
      return typeof conv === 'function' ? conv(uri) : uri
    } catch {
      return uri
    }
  }

  return {
    async get(id) {
      if (!id) return null
      const key = sanitizeId(id)
      const index = loadIndex()
      const entry = index[key]
      if (!entry) return null

      const fs = await getFilesystem()
      if (!fs) return null

      try {
        const filePath = `${CACHE_DIR}/${key}.gif`
        const uriRes = await fs.Filesystem.getUri({
          path: filePath,
          directory: fs.Directory.Cache,
        })

        // Touch timestamp and sequence on read
        globalSeq++
        entry.at = Date.now() + (globalSeq * 0.001)
        entry.seq = globalSeq
        index[key] = entry
        saveIndex(index)

        return toWebUri(uriRes?.uri)
      } catch {
        // File was evicted or removed by OS — clean index entry
        delete index[key]
        saveIndex(index)
        return null
      }
    },

    async put(id, base64Data, sizeBytes = 0) {
      if (!id || !base64Data) return null
      const key = sanitizeId(id)
      const fs = await getFilesystem()
      if (!fs) return null

      const approxSize = sizeBytes || Math.round((base64Data.length * 3) / 4)
      const filePath = `${CACHE_DIR}/${key}.gif`
      const tempPath = `${CACHE_DIR}/${key}_temp.tmp`

      try {
        // Ensure cache directory exists
        try {
          await fs.Filesystem.mkdir({
            path: CACHE_DIR,
            directory: fs.Directory.Cache,
            recursive: true,
          })
        } catch { /* exists */ }

        // Write to temp file first to prevent partial corrupt files
        await fs.Filesystem.writeFile({
          path: tempPath,
          directory: fs.Directory.Cache,
          data: base64Data,
          recursive: true,
        })

        // Rename temp file to final destination
        try {
          await fs.Filesystem.rename({
            from: tempPath,
            to: filePath,
            directory: fs.Directory.Cache,
          })
        } catch {
          // If rename unsupported in mock/plugin, fallback to direct write
          await fs.Filesystem.writeFile({
            path: filePath,
            directory: fs.Directory.Cache,
            data: base64Data,
            recursive: true,
          })
        }

        globalSeq++
        const index = loadIndex()
        index[key] = {
          size: approxSize,
          at: Date.now() + (globalSeq * 0.001),
          seq: globalSeq,
        }

        // Perform LRU eviction if total exceeds budget
        let total = Object.values(index).reduce((sum, item) => sum + (item.size || 0), 0)
        if (total > maxBytes) {
          const sorted = Object.entries(index).sort((a, b) => (a[1].at || 0) - (b[1].at || 0))
          for (const [oldKey, oldItem] of sorted) {
            if (oldKey === key) continue // Don't evict the file just added
            try {
              await fs.Filesystem.deleteFile({
                path: `${CACHE_DIR}/${oldKey}.gif`,
                directory: fs.Directory.Cache,
              })
            } catch { /* ignore */ }
            delete index[oldKey]
            total -= oldItem.size || 0
            if (total <= maxBytes) break
          }
        }

        saveIndex(index)

        const uriRes = await fs.Filesystem.getUri({
          path: filePath,
          directory: fs.Directory.Cache,
        })
        return toWebUri(uriRes?.uri)
      } catch (err) {
        // Failed to write or save — degrade gracefully
        return null
      }
    },

    async usage() {
      const index = loadIndex()
      const entries = Object.values(index)
      const usedBytes = entries.reduce((sum, item) => sum + (item.size || 0), 0)
      return {
        usedBytes,
        count: entries.length,
        maxBytes,
      }
    },

    async clear() {
      const index = loadIndex()
      const fs = await getFilesystem()
      if (fs) {
        for (const key of Object.keys(index)) {
          try {
            await fs.Filesystem.deleteFile({
              path: `${CACHE_DIR}/${key}.gif`,
              directory: fs.Directory.Cache,
            })
          } catch { /* ignore */ }
        }
      }
      saveIndex({})
    },
  }
}
