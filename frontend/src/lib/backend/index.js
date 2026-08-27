// Backend adapter factory for openGym.
//
// Single entry point for backend resolution across web, mobile (Capacitor), and demo builds.
// In mobile and demo builds, local storage/native file persistence is selected at build time,
// allowing the bundler (Vite) to eliminate unused network/server code from standalone builds.

import { createLocalAdapter } from './local.js'
import { createServerAdapter } from './server.js'

export function getBackend(env = (typeof import.meta !== 'undefined' ? import.meta.env : {})) {
  const isMobile = env?.VITE_MOBILE === '1'
  const isDemo = env?.VITE_DEMO === '1'

  if (isMobile || isDemo) {
    return createLocalAdapter()
  }
  return createServerAdapter()
}

// Active singleton backend adapter for the application
export const backend = getBackend()
export const auth = backend.auth
export const state = backend.state
export const media = backend.media
export const api = backend.api
