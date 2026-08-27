import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAppwriteMediaProvider } from './appwriteMedia.js'

describe('Appwrite Media Provider', () => {
  let mockCache
  let mockNetwork
  let mockFetch

  beforeEach(() => {
    mockCache = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue('file:///cache/0001.gif'),
      usage: vi.fn().mockResolvedValue({ usedBytes: 0, count: 0 }),
      clear: vi.fn().mockResolvedValue(undefined),
    }

    mockNetwork = {
      getStatus: vi.fn().mockResolvedValue({ connected: true, connectionType: 'wifi' }),
    }

    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([71, 73, 70, 56, 57, 97]).buffer, // "GIF89a"
    })
  })

  it('resolves image URLs to bundled local img/ paths', () => {
    const media = createAppwriteMediaProvider({
      isNative: true,
      endpoint: 'https://sfo.cloud.appwrite.io/v1',
      projectId: 'proj_123',
    })

    expect(media.imageUrl('0001_bench')).toBe('img/0001_bench.jpg')
    expect(media.imageUrl({ id: 'bench', img: '0001-2gPfomN.jpg' })).toBe('img/0001-2gPfomN.jpg')
  })

  it('builds Appwrite Storage view URLs for animations', () => {
    const media = createAppwriteMediaProvider({
      isNative: true,
      endpoint: 'https://sfo.cloud.appwrite.io/v1',
      projectId: 'proj_123',
      bucketId: 'exercises',
    })

    const url = media.gifUrl({ id: 'bench', gif: '0001-2gPfomN.gif' })
    expect(url).toBe('https://sfo.cloud.appwrite.io/v1/storage/buckets/exercises/files/0001-2gPfomN/view?project=proj_123')
  })

  it('returns cached file URI immediately when GIF exists in local cache', async () => {
    mockCache.get.mockResolvedValueOnce('file:///cache/0001-2gPfomN.gif')

    const media = createAppwriteMediaProvider({
      isNative: true,
      cache: mockCache,
      network: mockNetwork,
      fetch: mockFetch,
    })

    const uri = await media.resolveGif({ id: 'bench', gif: '0001-2gPfomN.gif' })
    expect(uri).toBe('file:///cache/0001-2gPfomN.gif')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('refuses automatic download when on cellular data to conserve quota', async () => {
    mockNetwork.getStatus.mockResolvedValueOnce({ connected: true, connectionType: 'cellular' })

    const media = createAppwriteMediaProvider({
      isNative: true,
      cache: mockCache,
      network: mockNetwork,
      fetch: mockFetch,
    })

    const uri = await media.resolveGif({ id: 'bench', gif: '0001-2gPfomN.gif' })
    expect(uri).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('downloads and caches animation when connected to WiFi', async () => {
    mockNetwork.getStatus.mockResolvedValueOnce({ connected: true, connectionType: 'wifi' })

    const media = createAppwriteMediaProvider({
      isNative: true,
      endpoint: 'https://sfo.cloud.appwrite.io/v1',
      projectId: 'proj_123',
      cache: mockCache,
      network: mockNetwork,
      fetch: mockFetch,
    })

    const uri = await media.resolveGif({ id: 'bench', gif: '0001-2gPfomN.gif' })
    expect(uri).toBe('file:///cache/0001.gif')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockCache.put).toHaveBeenCalledWith('0001-2gPfomN', expect.any(String), expect.any(Number))
  })

  it('downloads over cellular when forceDownload flag is explicitly passed', async () => {
    mockNetwork.getStatus.mockResolvedValueOnce({ connected: true, connectionType: 'cellular' })

    const media = createAppwriteMediaProvider({
      isNative: true,
      endpoint: 'https://sfo.cloud.appwrite.io/v1',
      projectId: 'proj_123',
      cache: mockCache,
      network: mockNetwork,
      fetch: mockFetch,
    })

    const uri = await media.resolveGif({ id: 'bench', gif: '0001-2gPfomN.gif' }, { forceDownload: true })
    expect(uri).toBe('file:///cache/0001.gif')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
