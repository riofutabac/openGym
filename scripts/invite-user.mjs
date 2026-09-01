#!/usr/bin/env bash
// 2>/dev/null; exec node "$0" "$@"
//
// Operator script to invite and create a new user on a private openGym instance.
//
// Do NOT add user-limit juggling here. Public registration is closed by setting the project's
// user limit to the current account count, but a Server API key creates users through the admin
// path, which bypasses that limit — verified live against a project whose limit was already met.
// So this script just creates the account. The count then sits above the limit, which keeps public
// signup closed for free. Raising the limit to "make room" would reopen public registration for as
// long as it stayed raised, which is the hole the limit exists to close.
//
// Usage:
//   node scripts/invite-user.mjs \
//     --email user@example.com \
//     [--name "User Name"] \
//     [--password "TempPassword123!"] \
//     --key <api-key-with-users-write-scope> \
//     [--endpoint https://sfo.cloud.appwrite.io/v1] \
//     [--project 6a904b0d003e4351232f]

import crypto from 'node:crypto'
import { Client, Users, ID, Query } from 'node-appwrite'

const parseArgs = () => {
  const args = process.argv.slice(2)
  const map = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        map[key] = next
        i++
      } else {
        map[key] = true
      }
    }
  }
  return map
}

const generateRandomPassword = () => {
  return 'Gym-' + crypto.randomBytes(6).toString('base64url') + '!'
}

const args = parseArgs()
const endpoint = args.endpoint || process.env.APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1'
const projectId = args.project || process.env.APPWRITE_PROJECT_ID || '6a904b0d003e4351232f'
const apiKey = args.key || process.env.APPWRITE_API_KEY
const email = args.email
const name = args.name || ''
const password = args.password || generateRandomPassword()

if (!apiKey) {
  console.error('Error: --key <api-key-with-users-write-scope> is required.')
  console.error('Example: node scripts/invite-user.mjs --email friend@example.com --key secret-key')
  process.exit(1)
}

if (!email) {
  console.error('Error: --email <email-address> is required.')
  console.error('Example: node scripts/invite-user.mjs --email friend@example.com --key secret-key')
  process.exit(1)
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey)

const users = new Users(client)

async function main() {
  console.log(`Connecting to Appwrite at ${endpoint} (project: ${projectId})...`)
  
  // Check if user already exists
  const existing = await users.list([Query.equal('email', email)]).catch(() => ({ total: 0, users: [] }))
  if (existing.total > 0) {
    console.error(`Error: User with email ${email} already exists (ID: ${existing.users[0].$id}).`)
    process.exit(1)
  }

  const userId = ID.unique()
  console.log(`Creating user ${email}...`)
  const user = await users.create(userId, email, undefined, password, name || undefined)

  console.log('')
  console.log('✅ User successfully created!')
  console.log('─────────────────────────────────────────')
  console.log(`User ID : ${user.$id}`)
  console.log(`Email   : ${user.email}`)
  console.log(`Name    : ${user.name || '(none)'}`)
  console.log(`Password: ${password}`)
  console.log('─────────────────────────────────────────')
  console.log('Share these credentials securely with the invited user.')
  console.log('They can log in and update their password in Settings.')
}

main().catch((err) => {
  console.error('Error creating user:', err.message || err)
  process.exit(1)
})
