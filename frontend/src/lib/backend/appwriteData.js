// Appwrite state repository for openGym.
//
// Replaces monolithic state blobs with per-user profile documents and granular
// per-session workout rows in Appwrite Databases / TablesDB.
//
// Implements row-level document security (Permission.read/update/delete for Role.user(uid)),
// client-side deterministic IDs for idempotent workout writes, and cursor-based pagination.

import { DATABASE_ID, TABLES, PROFILE_COLUMNS, WORKOUT_COLUMNS } from './schema.js'

export function createAppwriteStateRepo(options = {}) {
  const databaseId =
    options.databaseId ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APPWRITE_DATABASE_ID) ||
    DATABASE_ID

  let cachedDb = options.databases || null
  let cachedSDK = options.sdk || null

  const getSDK = async () => {
    if (cachedSDK) return cachedSDK
    if (options.Query && options.Permission && options.Role) {
      cachedSDK = {
        Query: options.Query,
        Role: options.Role,
        Permission: options.Permission,
        Databases: options.Databases,
        Client: options.Client,
      }
      return cachedSDK
    }
    const sdk = await import('appwrite')
    cachedSDK = sdk
    return cachedSDK
  }

  const getDb = async () => {
    if (cachedDb) return cachedDb
    const sdk = await getSDK()
    if (!options.client && !options.databases) {
      const endpoint =
        options.endpoint ||
        (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APPWRITE_ENDPOINT) ||
        ''
      const projectId =
        options.projectId ||
        (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APPWRITE_PROJECT_ID) ||
        ''

      if (!projectId) throw new Error('VITE_APPWRITE_PROJECT_ID is required to access Appwrite database')
      if (!endpoint) throw new Error('VITE_APPWRITE_ENDPOINT is required to access Appwrite database')

      const client = new sdk.Client().setEndpoint(endpoint).setProject(projectId)
      cachedDb = new sdk.Databases(client)
    } else {
      cachedDb = options.databases || new sdk.Databases(options.client)
    }
    return cachedDb
  }

  const safeJsonParse = (str, fallback) => {
    if (!str || typeof str !== 'string') return fallback
    try {
      return JSON.parse(str)
    } catch {
      return fallback
    }
  }

  const serializeProfile = (profile) => {
    return {
      [PROFILE_COLUMNS.TS]: profile.ts || Date.now(),
      [PROFILE_COLUMNS.SETTINGS]: JSON.stringify(profile.settings || {}),
      [PROFILE_COLUMNS.ROUTINES]: JSON.stringify(profile.routines || []),
      [PROFILE_COLUMNS.WEEK]: JSON.stringify(profile.week || {}),
      [PROFILE_COLUMNS.DAY_PLAN]: JSON.stringify(profile.dayPlan || {}),
      [PROFILE_COLUMNS.EX_WEIGHTS]: JSON.stringify(profile.exWeights || {}),
      [PROFILE_COLUMNS.CUSTOM_EX]: JSON.stringify(profile.customEx || []),
      [PROFILE_COLUMNS.BODYWEIGHT]: JSON.stringify(profile.bodyweight || []),
    }
  }

  const deserializeProfile = (doc) => {
    if (!doc) return null
    return {
      ts: doc[PROFILE_COLUMNS.TS] || 0,
      settings: safeJsonParse(doc[PROFILE_COLUMNS.SETTINGS], {}),
      routines: safeJsonParse(doc[PROFILE_COLUMNS.ROUTINES], []),
      week: safeJsonParse(doc[PROFILE_COLUMNS.WEEK], {}),
      dayPlan: safeJsonParse(doc[PROFILE_COLUMNS.DAY_PLAN], {}),
      exWeights: safeJsonParse(doc[PROFILE_COLUMNS.EX_WEIGHTS], {}),
      customEx: safeJsonParse(doc[PROFILE_COLUMNS.CUSTOM_EX], []),
      bodyweight: safeJsonParse(doc[PROFILE_COLUMNS.BODYWEIGHT], []),
    }
  }

  const serializeWorkout = (userId, w) => {
    const entriesStr = typeof w.entries === 'string' ? w.entries : JSON.stringify(w.entries || [])
    if (entriesStr.length > 200000) {
      throw new Error(`Workout session ${w.id} exceeds maximum entries storage limit`)
    }

    return {
      [WORKOUT_COLUMNS.USER_ID]: userId,
      [WORKOUT_COLUMNS.D]: w.d || new Date().toISOString().slice(0, 10),
      [WORKOUT_COLUMNS.START]: w.start || 0,
      [WORKOUT_COLUMNS.END]: w.end || 0,
      [WORKOUT_COLUMNS.ROUTINE_ID]: w.routineId || '',
      [WORKOUT_COLUMNS.NAME]: w.name || '',
      [WORKOUT_COLUMNS.BW]: typeof w.bw === 'number' ? w.bw : null,
      [WORKOUT_COLUMNS.VOL]: typeof w.vol === 'number' ? w.vol : null,
      [WORKOUT_COLUMNS.PRS]: JSON.stringify(w.prs || []),
      [WORKOUT_COLUMNS.ENTRIES]: entriesStr,
    }
  }

  const deserializeWorkout = (doc) => {
    if (!doc) return null
    return {
      id: doc.$id,
      d: doc[WORKOUT_COLUMNS.D],
      start: doc[WORKOUT_COLUMNS.START],
      end: doc[WORKOUT_COLUMNS.END],
      routineId: doc[WORKOUT_COLUMNS.ROUTINE_ID] || undefined,
      name: doc[WORKOUT_COLUMNS.NAME] || '',
      bw: doc[WORKOUT_COLUMNS.BW] ?? undefined,
      vol: doc[WORKOUT_COLUMNS.VOL] ?? undefined,
      prs: safeJsonParse(doc[WORKOUT_COLUMNS.PRS], []),
      entries: safeJsonParse(doc[WORKOUT_COLUMNS.ENTRIES], []),
    }
  }

  return {
    supportsPerSessionRows: true,

    async loadProfile(userId) {
      if (!userId) return null
      try {
        const db = await getDb()
        const doc = await db.getDocument(databaseId, TABLES.PROFILES, userId)
        return deserializeProfile(doc)
      } catch (err) {
        if (err.code === 404 || err.status === 404) return null
        const e = new Error(err.message || 'Failed to load profile')
        e.status = err.code || err.status || 500
        throw e
      }
    },

    async saveProfile(userId, profile) {
      if (!userId) throw new Error('userId is required to save profile')
      const db = await getDb()
      const sdk = await getSDK()
      const payload = serializeProfile(profile)
      payload[PROFILE_COLUMNS.USER_ID] = userId

      const permissions = [
        sdk.Permission.read(sdk.Role.user(userId)),
        sdk.Permission.update(sdk.Role.user(userId)),
        sdk.Permission.delete(sdk.Role.user(userId)),
      ]

      try {
        await db.updateDocument(databaseId, TABLES.PROFILES, userId, payload)
      } catch (err) {
        if (err.code === 404 || err.status === 404) {
          await db.createDocument(databaseId, TABLES.PROFILES, userId, payload, permissions)
        } else {
          const e = new Error(err.message || 'Failed to save profile')
          e.status = err.code || err.status || 500
          throw e
        }
      }
    },

    async listWorkouts(userId, opts = {}) {
      if (!userId) return []
      const db = await getDb()
      const sdk = await getSDK()

      const queries = [
        sdk.Query.equal(WORKOUT_COLUMNS.USER_ID, userId),
        sdk.Query.orderAsc(WORKOUT_COLUMNS.D),
        sdk.Query.limit(100),
      ]

      if (opts.afterDate) {
        queries.push(sdk.Query.greaterThan(WORKOUT_COLUMNS.D, opts.afterDate))
      }

      let allDocuments = []
      let lastId = null
      let hasMore = true

      while (hasMore) {
        const pageQueries = [...queries]
        if (lastId) {
          pageQueries.push(sdk.Query.cursorAfter(lastId))
        }

        const res = await db.listDocuments(databaseId, TABLES.WORKOUTS, pageQueries)
        const docs = res.documents || []
        allDocuments = allDocuments.concat(docs)

        if (docs.length < 100) {
          hasMore = false
        } else {
          lastId = docs[docs.length - 1].$id
        }
      }

      return allDocuments.map(deserializeWorkout)
    },

    async saveWorkout(userId, workout) {
      if (!userId) throw new Error('userId is required to save workout')
      if (!workout?.id) throw new Error('workout.id is required')

      const db = await getDb()
      const sdk = await getSDK()
      const payload = serializeWorkout(userId, workout)
      const workoutId = String(workout.id)

      const permissions = [
        sdk.Permission.read(sdk.Role.user(userId)),
        sdk.Permission.update(sdk.Role.user(userId)),
        sdk.Permission.delete(sdk.Role.user(userId)),
      ]

      try {
        await db.updateDocument(databaseId, TABLES.WORKOUTS, workoutId, payload)
      } catch (err) {
        if (err.code === 404 || err.status === 404) {
          try {
            await db.createDocument(databaseId, TABLES.WORKOUTS, workoutId, payload, permissions)
          } catch (createErr) {
            if (createErr.code === 409 || createErr.status === 409) {
              await db.updateDocument(databaseId, TABLES.WORKOUTS, workoutId, payload)
            } else {
              throw createErr
            }
          }
        } else {
          const e = new Error(err.message || 'Failed to save workout')
          e.status = err.code || err.status || 500
          throw e
        }
      }
    },

    async deleteWorkout(userId, workoutId) {
      if (!workoutId) return
      const db = await getDb()
      try {
        await db.deleteDocument(databaseId, TABLES.WORKOUTS, String(workoutId))
      } catch (err) {
        if (err.code === 404 || err.status === 404) return
        const e = new Error(err.message || 'Failed to delete workout')
        e.status = err.code || err.status || 500
        throw e
      }
    },

    // Composite facade methods for BackendAdapter compatibility
    async load() {
      const auth = options.auth
      const user = await auth?.currentUser?.()
      if (!user?.id || user.guest) return null

      try {
        const [profile, workouts] = await Promise.all([
          this.loadProfile(user.id),
          this.listWorkouts(user.id),
        ])

        if (!profile && workouts.length === 0) return null

        return {
          _ts: profile?.ts || 0,
          ...(profile?.settings || {}),
          routines: profile?.routines || [],
          week: profile?.week || {},
          dayPlan: profile?.dayPlan || {},
          exWeights: profile?.exWeights || {},
          customEx: profile?.customEx || [],
          bodyweight: profile?.bodyweight || [],
          workouts: workouts || [],
        }
      } catch {
        return null
      }
    },

    async save(state) {
      const auth = options.auth
      const user = await auth?.currentUser?.()
      if (!user?.id || user.guest || !state) return

      // In-progress workout is device-local and must never be saved remotely
      const { routines, week, dayPlan, exWeights, customEx, bodyweight, workouts, active, _ts, ...settings } = state

      const profile = {
        ts: _ts || Date.now(),
        settings,
        routines: routines || [],
        week: week || {},
        dayPlan: dayPlan || {},
        exWeights: exWeights || {},
        customEx: customEx || [],
        bodyweight: bodyweight || [],
      }

      await this.saveProfile(user.id, profile)

      if (Array.isArray(workouts)) {
        for (const w of workouts) {
          if (w?.id) {
            await this.saveWorkout(user.id, w)
          }
        }
      }
    },
  }
}
