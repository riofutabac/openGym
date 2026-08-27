// Backend contracts for openGym.
//
// These JSDoc type definitions document the repository and provider interfaces that all
// backend implementations (server, local/mobile, demo, and Appwrite adapters) must conform to.
//
// The contracts are deliberately domain-scoped rather than exposing a monolithic state or
// coupled network calls. This allows subsequent milestones to migrate data models (e.g. from
// state blobs to per-session rows) or swap storage providers without rewriting UI components.

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {string} [email]
 * @property {boolean} [admin]
 * @property {boolean} [guest]
 */

/**
 * Interface for authentication and session management.
 * @typedef {Object} AuthProvider
 * @property {() => Promise<User|null>} currentUser - Returns the active user session, or null if unauthenticated.
 * @property {(emailOrName: string, passwordOrCode?: string, name?: string) => Promise<User>} register - Registers a new account / profile.
 * @property {(credentials?: any) => Promise<User>} login - Authenticates or resumes an existing session.
 * @property {(email: string, password: string) => Promise<User>} [loginWithEmail] - Authenticates with email and password.
 * @property {(provider: string) => Promise<void>} [loginWithOAuth] - Initiates OAuth2 authorization flow.
 * @property {() => Promise<void>} logout - Ends the current session on this device.
 * @property {() => Promise<void>} logoutEverywhere - Invalidation of all active sessions across devices.
 * @property {boolean} [supportsEmailPassword] - True if adapter supports email/password authentication.
 * @property {boolean} [supportsOAuth] - True if adapter supports OAuth2 authentication.
 */

/**
 * Interface for persisting and retrieving user training state.
 * @typedef {Object} StateRepository
 * @property {() => Promise<Object|null>} load - Loads persisted state, or null if no state is available.
 * @property {(state: Object) => Promise<void>} save - Persists state to the storage backend.
 */

/**
 * Interface for media asset URL resolution.
 * @typedef {Object} MediaProvider
 * @property {(id: string) => string} imageUrl - Returns the URL or local asset path for an exercise image.
 * @property {(id: string) => string} gifUrl - Returns the URL or cached asset path for an exercise animation.
 */

/**
 * Composite backend adapter interface.
 * @typedef {Object} BackendAdapter
 * @property {AuthProvider} auth
 * @property {StateRepository} state
 * @property {MediaProvider} media
 * @property {(path: string, opts?: Object) => Promise<any>} [api]
 */
