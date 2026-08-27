import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createGifCache, CACHE_INDEX_KEY } from './gifCache.js'

describe('LRU GIF Cache', () => {
  let virtualFs
  let mockStorage

  beforeEach(() => {
    virtualFs = new Map()
    mockStorage = new Map()

    globalThis.localStorage = {
      getItem: k => (mockStorage.has(k) ? mockStorage.get(k) : null),
      setItem: (k, v) => mockStorage.set(k, String(v)),
      removeItem: k => mockStorage.delete(k),
      clear: () => mockStorage.clear(),
    }
  })

  const createMockFilesystem = () => ({
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockImplementation(async ({ path, data }) => {
      virtualFs.set(path, data)
    }),
    rename: vi.fn().mockImplementation(async ({ from, to }) => {
      if (virtualFs.has(from)) {
        const val = virtualFs.get(from)
        virtualFs.delete(from)
        virtualFs.set(to, val)
      }
    }),
    deleteFile: vi.fn().mockImplementation(async ({ path }) => {
      virtualFs.delete(path)
    }),
    getUri: vi.fn().mockImplementation(async ({ path }) => {
      if (virtualFs.has(path)) {
        return { uri: `file:///data/cache/${path}` }
      }
      throw new Error('File not found')
    }),
  })

  it('stores and retrieves cached animation file URIs', async () => {
    const fs = createMockFilesystem()
    const cache = createGifCache({ filesystem: fs, storage: globalThis.localStorage })

    const putRes = await cache.put('0001_bench', 'BASE64_DATA_1', 1000)
    expect(putRes).toBe('file:///data/cache/opengym_gifs/0001_bench.gif')

    const getRes = await cache.get('0001_bench')
    expect(getRes).toBe('file:///data/cache/opengym_gifs/0001_bench.gif')
  })

  it('evicts least recently accessed items when cache budget is exceeded', async () => {
    const fs = createMockFilesystem()
    // 2500 bytes max budget
    const cache = createGifCache({ maxBytes: 2500, filesystem: fs, storage: globalThis.localStorage })

    // Add item 1 (1000 bytes)
    await cache.put('gif_1', 'DATA_1', 1000)
    // Add item 2 (1000 bytes)
    await cache.put('gif_2', 'DATA_2', 1000)

    // Touch item 1 by accessing it (making item 2 older)
    await cache.get('gif_1')

    // Add item 3 (1000 bytes) -> total would be 3000 > 2500, item 2 should be evicted
    await cache.put('gif_3', 'DATA_3', 1000)

    const usage = await cache.usage()
    expect(usage.count).toBe(2)
    expect(usage.usedBytes).toBe(2000)

    // item 1 and item 3 are in cache; item 2 is evicted
    expect(await cache.get('gif_1')).not.toBeNull()
    expect(await cache.get('gif_3')).not.toBeNull()
    expect(await cache.get('gif_2')).toBeNull()
  })

  it('recovers gracefully from a corrupted index without throwing', async () => {
    const fs = createMockFilesystem()
    mockStorage.set(CACHE_INDEX_KEY, '{ invalid_json :::')

    const cache = createGifCache({ filesystem: fs, storage: globalThis.localStorage })
    expect(await cache.get('any_id')).toBeNull()

    const putRes = await cache.put('clean_id', 'DATA', 500)
    expect(putRes).not.toBeNull()

    const usage = await cache.usage()
    expect(usage.count).toBe(1)
  })

  it('clears all cached items and resets usage', async () => {
    const fs = createMockFilesystem()
    const cache = createGifCache({ filesystem: fs, storage: globalThis.localStorage })

    await cache.put('gif_a', 'DATA_A', 1000)
    await cache.put('gif_b', 'DATA_B', 1500)

    expect((await cache.usage()).count).toBe(2)

    await cache.clear()

    expect((await cache.usage()).count).toBe(0)
    expect((await cache.usage()).usedBytes).toBe(0)
    expect(await cache.get('gif_a')).toBeNull()
  })
})
