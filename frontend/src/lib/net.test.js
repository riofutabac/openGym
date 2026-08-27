import { describe, it, expect, vi } from 'vitest'
import { isOnline, onReconnect } from './net.js'

describe('net.js - Connectivity and Reconnection Helper', () => {
  it('returns a plain boolean primitive from isOnline and never an object with .then', async () => {
    const res = await isOnline()
    expect(typeof res).toBe('boolean')
    expect(res).not.toHaveProperty('then')
  })

  it('fails open (returns true) if the network check errors or is ambiguous', async () => {
    const throwingNetwork = {
      getStatus: vi.fn().mockRejectedValue(new Error('Plugin error')),
    }
    const res = await isOnline({ network: throwingNetwork })
    expect(res).toBe(true)
  })

  it('returns false only when network explicitly reports connected: false', async () => {
    const offlineNetwork = {
      getStatus: vi.fn().mockResolvedValue({ connected: false, connectionType: 'none' }),
    }
    const res = await isOnline({ network: offlineNetwork })
    expect(res).toBe(false)
  })

  it('triggers onReconnect callback only when transitioning from offline to online', async () => {
    let listener = null
    const mockNetwork = {
      getStatus: vi.fn().mockResolvedValue({ connected: true }),
      addListener: vi.fn((event, cb) => {
        listener = cb
        return Promise.resolve({ remove: vi.fn() })
      }),
    }

    const callback = vi.fn()
    const unsubscribe = onReconnect(callback, { network: mockNetwork })

    expect(mockNetwork.addListener).toHaveBeenCalledWith('networkStatusChange', expect.any(Function))

    // 1. Initial state -> offline
    listener({ connected: false })
    expect(callback).not.toHaveBeenCalled()

    // 2. Offline -> online (reconnection) -> MUST fire callback
    listener({ connected: true })
    expect(callback).toHaveBeenCalledTimes(1)

    // 3. Online -> online -> should NOT re-fire
    listener({ connected: true })
    expect(callback).toHaveBeenCalledTimes(1)

    // 4. Offline -> online again -> MUST fire callback again
    listener({ connected: false })
    listener({ connected: true })
    expect(callback).toHaveBeenCalledTimes(2)

    // 5. Unsubscribe -> further events ignored
    unsubscribe()
    listener({ connected: false })
    listener({ connected: true })
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('fires callback when network comes back even if app booted while offline without prior offline event', async () => {
    let listener = null
    const mockNetwork = {
      getStatus: vi.fn().mockResolvedValue({ connected: false, connectionType: 'none' }),
      addListener: vi.fn((event, cb) => {
        listener = cb
        return Promise.resolve({ remove: vi.fn() })
      }),
    }

    const callback = vi.fn()
    onReconnect(callback, { network: mockNetwork })

    // Allow initial isOnline check to resolve and seed lastWasOffline = true
    await new Promise(r => setTimeout(r, 10))

    // First event that arrives is connected: true (airplane mode turned off)
    listener({ connected: true })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('cleans up native listener when unsubscribe is called before addListener resolves', async () => {
    const removeMock = vi.fn()
    let resolveListener
    const mockNetwork = {
      getStatus: vi.fn().mockResolvedValue({ connected: true }),
      addListener: vi.fn(() => new Promise(r => { resolveListener = r })),
    }

    const callback = vi.fn()
    const unsubscribe = onReconnect(callback, { network: mockNetwork })

    // Immediate unsubscribe before promise resolution
    unsubscribe()

    // Promise resolves later
    resolveListener({ remove: removeMock })
    await new Promise(r => setTimeout(r, 5))

    expect(removeMock).toHaveBeenCalledTimes(1)
  })
})
