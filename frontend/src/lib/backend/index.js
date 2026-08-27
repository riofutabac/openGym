// Backend adapter factory for openGym.
//
// Single entry point for backend resolution across web, mobile APK, and demo builds.
// In standard and mobile builds, Appwrite is the unified backend for authentication,
// user profile, and per-session workout rows. In demo builds, purely local storage is used.

import { createLocalAdapter } from './local.js'
import { createAppwriteAdapter } from './appwrite.js'

export function getBackend(env = (typeof import.meta !== 'undefined' ? import.meta.env : {})) {
  const isDemo = env?.VITE_DEMO === '1'

  // Demo build (GitHub Pages): purely local storage with example data seeding
  if (isDemo) {
    return createLocalAdapter({ mockDemo: true })
  }

  // Standard web and mobile APK builds: Appwrite Cloud / Self-hosted backend
  return createAppwriteAdapter({
    endpoint: env?.VITE_APPWRITE_ENDPOINT,
    projectId: env?.VITE_APPWRITE_PROJECT_ID,
    oauthProvider: env?.VITE_APPWRITE_OAUTH_PROVIDER,
    databaseId: env?.VITE_APPWRITE_DATABASE_ID,
  })
}

// Active singleton backend adapter for the application
export const backend = getBackend()
export const auth = backend.auth
export const state = backend.state
export const media = backend.media
export const api = backend.api
