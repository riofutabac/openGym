// Server backend adapter for openGym.
//
// TODO (Milestone 3): The passkey session cookie emitted by api/server.js authorizes PUT /api/data.
// Once state persistence moves to Appwrite Databases in Milestone 3, this entire adapter and
// its custom passkeys will be decommissioned.
//
// Encapsulates the custom Node.js backend (REST endpoints + WebAuthn passkeys).
// Network calls go through api() which attaches the JSON content-type and preserves
// the HTTP status code on errors (e.status), allowing callers to handle 401 or offline
// state cleanly.

const IMG_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_IMG_BASE) || 'img/'
const GIF_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GIF_BASE) || 'gif/'

const bufToB64u = buf =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const b64uToBuf = s =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)).buffer

function toCreationOptions(o) {
  o.challenge = b64uToBuf(o.challenge)
  o.user.id = b64uToBuf(o.user.id)
  ;(o.excludeCredentials || []).forEach(c => {
    c.id = b64uToBuf(c.id)
  })
  return o
}

function toRequestOptions(o) {
  o.challenge = b64uToBuf(o.challenge)
  ;(o.allowCredentials || []).forEach(c => {
    c.id = b64uToBuf(c.id)
  })
  return o
}

function credToJSON(cred) {
  const r = cred.response
  const out = {
    id: cred.id,
    rawId: bufToB64u(cred.rawId),
    type: cred.type,
    clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
    authenticatorAttachment: cred.authenticatorAttachment || null,
    response: { clientDataJSON: bufToB64u(r.clientDataJSON) },
  }
  if (r.attestationObject) {
    out.response.attestationObject = bufToB64u(r.attestationObject)
    out.response.transports = r.getTransports ? r.getTransports() : ['internal']
  }
  if (r.authenticatorData) {
    out.response.authenticatorData = bufToB64u(r.authenticatorData)
    out.response.signature = bufToB64u(r.signature)
    out.response.userHandle = r.userHandle ? bufToB64u(r.userHandle) : null
  }
  return out
}

export function createServerAdapter(options = {}) {
  const customFetch = options.fetchFn || (typeof fetch !== 'undefined' ? fetch : null)

  const api = async (path, opts = {}) => {
    if (!customFetch) {
      throw new Error('fetch is not available')
    }
    const r = await customFetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts))
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      const e = new Error(data.error || 'HTTP ' + r.status)
      e.status = r.status
      throw e
    }
    return data
  }

  return {
    api,
    state: {
      async load() {
        try {
          const res = await api('/api/data')
          return res.state || null
        } catch {
          return null
        }
      },

      async save(state) {
        await api('/api/data', {
          method: 'PUT',
          body: JSON.stringify({ state }),
        })
      },
    },

    auth: {
      async currentUser() {
        try {
          const me = await api('/api/me')
          return me.user || null
        } catch {
          return null
        }
      },

      async register(name, code) {
        const { cid, options } = await api('/api/register/options', {
          method: 'POST',
          body: JSON.stringify({ name, code: code || '' }),
        })
        const cred = await navigator.credentials.create({ publicKey: toCreationOptions(options) })
        const res = await api('/api/register/verify', {
          method: 'POST',
          body: JSON.stringify({ cid, credential: credToJSON(cred) }),
        })
        return res.user
      },

      async login() {
        const { cid, options } = await api('/api/login/options', {
          method: 'POST',
          body: '{}',
        })
        const cred = await navigator.credentials.get({ publicKey: toRequestOptions(options) })
        const res = await api('/api/login/verify', {
          method: 'POST',
          body: JSON.stringify({ cid, credential: credToJSON(cred) }),
        })
        return res.user
      },

      async logout() {
        try {
          await api('/api/logout', { method: 'POST', body: '{}' })
        } catch {
          // Swallow offline logout failure
        }
      },

      async logoutEverywhere() {
        await api('/api/logout/all', { method: 'POST', body: '{}' })
      },
    },

    media: {
      imageUrl(id) {
        return `${IMG_BASE}${id}.jpg`
      },
      gifUrl(id) {
        return `${GIF_BASE}${id}.gif`
      },
    },
  }
}
