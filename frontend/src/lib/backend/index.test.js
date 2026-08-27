import { describe, it, expect } from 'vitest'
import { getBackend } from './index.js'

describe('Backend Factory', () => {
  it('returns Appwrite adapter in default environment', async () => {
    const backend = getBackend({})
    expect(backend).toBeDefined()
    expect(backend.state).toBeDefined()
    expect(backend.state.supportsPerSessionRows).toBe(true)
    expect(backend.auth).toBeDefined()
    expect(backend.auth.supportsEmailPassword).toBe(true)
    expect(backend.media).toBeDefined()
    await expect(backend.api('/test')).rejects.toThrow()
  })

  it('advertises OAuth once a provider is configured', async () => {
    const backend = getBackend({ VITE_APPWRITE_OAUTH_PROVIDER: 'google' })
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
})
