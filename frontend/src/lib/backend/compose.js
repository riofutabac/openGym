// Composite backend adapter helper for openGym.
//
// Combines discrete domain providers (auth, state repository, media provider) into
// a unified BackendAdapter instance. This allows composing remote authentication (e.g. Appwrite)
// with local state persistence and local media without duplicating adapter code.

export function composeAdapter({ auth, state, media, api } = {}) {
  if (!auth) throw new Error('composeAdapter requires an auth provider')
  if (!state) throw new Error('composeAdapter requires a state repository')
  if (!media) throw new Error('composeAdapter requires a media provider')

  return {
    auth,
    state,
    media,
    api:
      api ||
      (async () => {
        throw new Error('API network calls are not available on this composed adapter')
      }),
  }
}
