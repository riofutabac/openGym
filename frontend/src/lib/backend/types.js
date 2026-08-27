// Backend contracts for openGym.
//
// These JSDoc type definitions document the repository and provider interfaces that all
// backend implementations (local/mobile, demo, and Appwrite adapters) must conform to.
//
// The contracts are domain-scoped rather than exposing a monolithic state blob.
// Per-session rows and per-user profiles are persisted discretely in Appwrite TablesDB.

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
 * @property {(urlStr: string) => Promise<User|null>} [handleOAuthCallback] - Processes OAuth callback deep link.
 * @property {() => Promise<void>} logout - Ends the current session on this device.
 * @property {() => Promise<void>} logoutEverywhere - Invalidation of all active sessions across devices.
 * @property {boolean} [supportsEmailPassword] - True if adapter supports email/password authentication.
 * @property {boolean} [supportsOAuth] - True if adapter supports OAuth2 authentication.
 */

/**
 * @typedef {Object} ProfileDocument
 * @property {number} ts - Timestamp governing last-write-wins for profile fields only.
 * @property {Object} settings - User preferences (unit, timer, theme, language, etc).
 * @property {Array} routines - Routine templates.
 * @property {Object} week - Weekly training schedule map.
 * @property {Object} exWeights - Last used weight mapping per exercise.
 * @property {Array} customEx - Custom created exercise definitions.
 * @property {Array} bodyweight - Logged body weight history points.
 */

/**
 * @typedef {Object} WorkoutRow
 * @property {string} id - Client-generated deterministic unique ID for the session.
 * @property {string} d - ISO date string (YYYY-MM-DD) for indexing and filtering.
 * @property {number} start - Session start epoch timestamp.
 * @property {number} end - Session end epoch timestamp.
 * @property {string} [routineId] - ID of routine performed if applicable.
 * @property {string} name - Routine or workout session name.
 * @property {number} [bw] - Body weight at the time of workout.
 * @property {number} [vol] - Total volume lifted.
 * @property {Array<string>} [prs] - IDs of exercises where PR was achieved.
 * @property {Array} entries - Exercise sets and reps entries.
 */

/**
 * Interface for persisting and retrieving user training state.
 * @typedef {Object} StateRepository
 * @property {() => Promise<Object|null>} load - Composite facade: loads full combined state.
 * @property {(state: Object) => Promise<void>} save - Composite facade: saves state to backend.
 * @property {(userId: string) => Promise<ProfileDocument|null>} [loadProfile] - Loads the user profile document.
 * @property {(userId: string, profile: ProfileDocument) => Promise<void>} [saveProfile] - Persists user profile.
 * @property {(userId: string, options?: { afterDate?: string }) => Promise<Array<WorkoutRow>>} [listWorkouts] - Lists user workouts.
 * @property {(userId: string, workout: WorkoutRow) => Promise<void>} [saveWorkout] - Persists single workout session idempotently.
 * @property {(userId: string, workoutId: string) => Promise<void>} [deleteWorkout] - Deletes single workout session.
 * @property {boolean} [supportsPerSessionRows] - True if repository supports granular per-session persistence.
 */

/**
 * Interface for media asset URL resolution.
 * @typedef {Object} MediaProvider
 * @property {(idOrEx: string | Object) => string} imageUrl - Returns the synchronous URL or local asset path for an exercise image (never empty).
 * @property {(idOrEx: string | Object) => string} gifUrl - Returns the synchronous remote URL or asset path for an exercise animation.
 * @property {(ex: Object, options?: { forceDownload?: boolean }) => Promise<string | null>} [resolveGif] - Asynchronously resolves cached local file URI or downloads if permitted.
 * @property {() => Promise<{ usedBytes: number, count: number }>} [getCacheUsage] - Returns current cache usage statistics.
 * @property {() => Promise<void>} [clearCache] - Clears downloaded animation cache.
 * @property {boolean} [supportsGifCache] - True if provider implements local offline GIF caching.
 */

/**
 * Composite backend adapter interface.
 * @typedef {Object} BackendAdapter
 * @property {AuthProvider} auth
 * @property {StateRepository} state
 * @property {MediaProvider} media
 * @property {(path: string, opts?: Object) => Promise<any>} [api]
 */
