// UI / Browser helpers and legacy api access.
//
// TODO (Milestone 7): retire direct api() usage once /api/admin/*, /api/config and push endpoints are decommissioned.
import { api as backendApi, auth } from './backend/index.js'

export const IS_APPLE = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)
export const IS_ANDROID = typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent)
export const BIO = IS_APPLE ? 'Face ID / Touch ID' : IS_ANDROID ? 'fingerprint or face unlock' : 'your fingerprint, face or PIN'
export const VAULT = IS_APPLE ? 'iCloud Keychain' : IS_ANDROID ? 'Google Password Manager' : 'your password manager'
export const webauthnOK = () => typeof window !== 'undefined' && !!(window.PublicKeyCredential && navigator?.credentials)

export const api = (path, opts) => {
  if (typeof backendApi === 'function') {
    return backendApi(path, opts)
  }
  throw new Error('API is not supported by the active backend adapter')
}

export const passkeyRegister = (name, code) => auth.register(name, code)
export const passkeyLogin = () => auth.login()
