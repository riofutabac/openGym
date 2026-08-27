import { describe, it, expect } from 'vitest'
import { getBackend } from './index.js'

describe('Backend Factory', () => {
  it('returns composed Appwrite auth + local persistence when VITE_MOBILE=1', async () => {
    const backend = getBackend({ VITE_MOBILE: '1' })
    expect(backend).toBeDefined()
    expect(backend.state).toBeDefined()
    expect(backend.auth).toBeDefined()
    expect(backend.auth.supportsEmailPassword).toBe(true)
    // OAuth stays hidden until a provider is configured — an unconfigured
    // provider means a button that fails when pressed
    expect(backend.auth.supportsOAuth).toBe(false)
    expect(backend.media).toBeDefined()
    await expect(backend.api('/test')).rejects.toThrow()
  })

  it('returns composed Appwrite auth when VITE_APPWRITE=1', async () => {
    const backend = getBackend({ VITE_APPWRITE: '1' })
    expect(backend).toBeDefined()
    expect(backend.auth.supportsEmailPassword).toBe(true)
    expect(backend.auth.supportsOAuth).toBe(false)
    expect(backend.state).toBeDefined()
  })

  it('advertises OAuth once a provider is configured', async () => {
    const backend = getBackend({ VITE_APPWRITE: '1', VITE_APPWRITE_OAUTH_PROVIDER: 'google' })
    expect(backend.auth.supportsOAuth).toBe(true)
    expect(backend.auth.oauthProviderName).toBe('Google')
  })

  it('returns local adapter when VITE_DEMO=1', async () => {
    const backend = getBackend({ VITE_DEMO: '1' })
    expect(backend).toBeDefined()
    expect(backend.state).toBeDefined()
    expect(backend.auth).toBeDefined()
    expect(backend.media).toBeDefined()
    await expect(backend.api('/test')).rejects.toThrow('API network calls are disabled in local backend mode')
  })

  it('returns server adapter in default web environment', () => {
    const backend = getBackend({})
    expect(backend).toBeDefined()
    expect(backend.state).toBeDefined()
    expect(backend.auth).toBeDefined()
    expect(backend.media).toBeDefined()
    expect(typeof backend.api).toBe('function')
  })
})
