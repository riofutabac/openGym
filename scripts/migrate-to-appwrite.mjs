#!/usr/bin/env node
// Migration script: self-hosted db.json & state-*.json -> Appwrite Databases / TablesDB
//
// Usage:
//   node scripts/migrate-to-appwrite.mjs --db data/db.json --user <source-user-id> --account <appwrite-user-id>
//
// Required environment variables (or CLI options):
//   APPWRITE_ENDPOINT    (or --endpoint)  e.g. https://sfo.cloud.appwrite.io/v1
//   APPWRITE_PROJECT_ID  (or --project)   e.g. 6a904b0d003e4351232f
//   APPWRITE_API_KEY     (or --key)       Server API key with databases.read and databases.write scopes
//   APPWRITE_DATABASE_ID (or --database)  Defaults to 'opengym'

import fs from 'node:fs'
import path from 'node:path'
import { Client, Databases, Permission, Role, Query } from 'node-appwrite'

const args = process.argv.slice(2)
const getArg = (flag, fallback = '') => {
  const idx = args.indexOf(flag)
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1]
  return fallback
}

const dbPath = getArg('--db', 'data/db.json')
const sourceUserId = getArg('--user', '')
const targetAccountId = getArg('--account', '')
const endpoint = getArg('--endpoint', process.env.APPWRITE_ENDPOINT || '')
const projectId = getArg('--project', process.env.APPWRITE_PROJECT_ID || '')
const apiKey = getArg('--key', process.env.APPWRITE_API_KEY || '')
const databaseId = getArg('--database', process.env.APPWRITE_DATABASE_ID || 'opengym')

if (!sourceUserId || !targetAccountId) {
  console.error('Error: Both --user <source-user-id> and --account <appwrite-user-id> are required.')
  console.error('Example: node scripts/migrate-to-appwrite.mjs --db data/db.json --user piYdx5GveQarq8u9 --account 6a904b0d003e4351232f')
  process.exit(1)
}

if (!endpoint || !projectId || !apiKey) {
  console.error('Error: Appwrite credentials missing. Provide --endpoint, --project, and --key (or environment variables).')
  process.exit(1)
}

// 1. Locate and read source state
let sourceState = null

// Try finding user state in data/state-<sourceUserId>.json
const dir = path.dirname(dbPath)
const userStateFile = path.join(dir, `state-${sourceUserId}.json`)

if (fs.existsSync(userStateFile)) {
  try {
    sourceState = JSON.parse(fs.readFileSync(userStateFile, 'utf8'))
    console.log(`Found user state file: ${userStateFile}`)
  } catch (err) {
    console.error(`Failed to parse ${userStateFile}:`, err.message)
    process.exit(1)
  }
} else if (fs.existsSync(dbPath)) {
  try {
    const rawDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
    if (rawDb.state && rawDb.state[sourceUserId]) {
      sourceState = rawDb.state[sourceUserId]
      console.log(`Found user state inside ${dbPath}`)
    }
  } catch (err) {
    console.error(`Failed to parse ${dbPath}:`, err.message)
    process.exit(1)
  }
}

if (!sourceState) {
  console.warn(`No state found for user "${sourceUserId}". Migrating default empty profile.`)
  sourceState = {
    _ts: Date.now(),
    routines: [],
    week: {},
    exWeights: {},
    customEx: [],
    bodyweight: [],
    workouts: [],
  }
}

const { routines = [], week = {}, exWeights = {}, customEx = [], bodyweight = [], workouts = [], _ts, ...settings } = sourceState

console.log(`\nStarting migration to Appwrite project ${projectId} (database: ${databaseId}):`)
console.log(`- Source User: ${sourceUserId}`)
console.log(`- Target Account: ${targetAccountId}`)
console.log(`- Routines to migrate: ${routines.length}`)
console.log(`- Workouts to migrate: ${workouts.length}`)
console.log(`- Bodyweight points: ${bodyweight.length}`)

// 2. Initialize Appwrite server client
const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
const databases = new Databases(client)

const permissions = [
  Permission.read(Role.user(targetAccountId)),
  Permission.update(Role.user(targetAccountId)),
  Permission.delete(Role.user(targetAccountId)),
]

async function runMigration() {
  // A. Save profile
  const profilePayload = {
    userId: targetAccountId,
    ts: _ts || Date.now(),
    settings: JSON.stringify(settings || {}),
    routines: JSON.stringify(routines || []),
    week: JSON.stringify(week || {}),
    exWeights: JSON.stringify(exWeights || {}),
    customEx: JSON.stringify(customEx || []),
    bodyweight: JSON.stringify(bodyweight || []),
  }

  try {
    await databases.updateDocument(databaseId, 'profiles', targetAccountId, profilePayload)
    console.log(`✓ Profile document updated for account ${targetAccountId}`)
  } catch (err) {
    if (err.code === 404 || err.status === 404) {
      await databases.createDocument(databaseId, 'profiles', targetAccountId, profilePayload, permissions)
      console.log(`✓ Profile document created for account ${targetAccountId}`)
    } else {
      throw err
    }
  }

  // B. Save workout rows
  let migratedWorkouts = 0
  for (const w of workouts) {
    if (!w.id) {
      console.warn('Skipping workout without ID:', w)
      continue
    }

    const workoutPayload = {
      userId: targetAccountId,
      d: w.d || new Date().toISOString().slice(0, 10),
      start: w.start || 0,
      end: w.end || 0,
      routineId: w.routineId || '',
      name: w.name || '',
      bw: typeof w.bw === 'number' ? w.bw : null,
      vol: typeof w.vol === 'number' ? w.vol : null,
      prs: JSON.stringify(w.prs || []),
      entries: JSON.stringify(w.entries || []),
    }

    const docId = String(w.id)
    try {
      await databases.updateDocument(databaseId, 'workouts', docId, workoutPayload)
    } catch (err) {
      if (err.code === 404 || err.status === 404) {
        try {
          await databases.createDocument(databaseId, 'workouts', docId, workoutPayload, permissions)
        } catch (createErr) {
          if (createErr.code === 409 || createErr.status === 409) {
            await databases.updateDocument(databaseId, 'workouts', docId, workoutPayload)
          } else {
            throw createErr
          }
        }
      } else {
        throw err
      }
    }
    migratedWorkouts++
  }
  console.log(`✓ Successfully processed ${migratedWorkouts} workout rows`)

  // 3. Verification step: Read back from Appwrite and assert counts match source
  console.log('\nVerifying migrated data in Appwrite...')
  const verifiedProfileDoc = await databases.getDocument(databaseId, 'profiles', targetAccountId)
  const verifiedRoutines = JSON.parse(verifiedProfileDoc.routines || '[]')
  const verifiedBodyweight = JSON.parse(verifiedProfileDoc.bodyweight || '[]')

  // Fetch all workouts for user
  let remoteWorkouts = []
  let lastId = null
  let hasMore = true

  while (hasMore) {
    const q = [
      Query.equal('userId', targetAccountId),
      Query.limit(100),
    ]
    if (lastId) q.push(Query.cursorAfter(lastId))

    const res = await databases.listDocuments(databaseId, 'workouts', q)
    const docs = res.documents || []
    remoteWorkouts = remoteWorkouts.concat(docs)
    if (docs.length < 100) hasMore = false
    else lastId = docs[docs.length - 1].$id
  }

  console.log(`Verification Results:`)
  console.log(`- Routines: Expected ${routines.length}, Remote ${verifiedRoutines.length} [${routines.length === verifiedRoutines.length ? 'PASS' : 'FAIL'}]`)
  console.log(`- Bodyweight: Expected ${bodyweight.length}, Remote ${verifiedBodyweight.length} [${bodyweight.length === verifiedBodyweight.length ? 'PASS' : 'FAIL'}]`)
  console.log(`- Workouts: Expected ${workouts.length}, Remote ${remoteWorkouts.length} [${workouts.length === remoteWorkouts.length ? 'PASS' : 'FAIL'}]`)

  if (
    routines.length !== verifiedRoutines.length ||
    bodyweight.length !== verifiedBodyweight.length ||
    workouts.length !== remoteWorkouts.length
  ) {
    console.error('\n❌ Verification failed: Source and destination counts do not match.')
    process.exit(1)
  }

  console.log('\n✅ Migration and count verification completed successfully!')
}

runMigration().catch(err => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
