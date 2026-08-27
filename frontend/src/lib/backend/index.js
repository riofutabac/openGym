// Backend adapter factory for openGym.
//
// Single entry point for backend resolution across web (self-hosted Node), mobile APK (Appwrite),
// and demo (GitHub Pages) builds.
//
// In mobile and Appwrite builds, the adapter is composed of Appwrite authentication alongside
// local native file persistence and media resolution. In demo builds, purely local storage is used.

import { createLocalAdapter } from './local.js'
import { createServerAdapter } from './server.js'
import { createAppwriteAdapter } from './appwrite.js'
import { composeAdapter } from './compose.js'

export function getBackend(env = (typeof import.meta !== 'undefined' ? import.meta.env : {})) {
  const isDemo = env?.VITE_DEMO === '1'
  const isAppwrite = env?.VITE_APPWRITE === '1'
  const isMobile = env?.VITE_MOBILE === '1'

  // Demo build (GitHub Pages): purely local storage with example data seeding
  if (isDemo) {
    return createLocalAdapter({ mockDemo: true })
  }

  // Mobile APK or Web-Appwrite build: Appwrite auth composed with local persistence
  if (isAppwrite || isMobile) {
    const local = createLocalAdapter()
    const appwrite = createAppwriteAdapter({
      endpoint: env?.VITE_APPWRITE_ENDPOINT,
      projectId: env?.VITE_APPWRITE_PROJECT_ID,
      state: local.state,
      media: local.media,
    })

    return composeAdapter({
      auth: appwrite.auth,
      state: local.state,
      media: local.media,
      api: appwrite.api,
    })
  }

  // Default web build: self-hosted Node server with passkeys
  return createServerAdapter()
}

// Active singleton backend adapter for the application
export const backend = getBackend()
export const auth = backend.auth
export const state = backend.state
export const media = backend.media
export const api = backend.api
