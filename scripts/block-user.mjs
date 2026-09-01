#!/usr/bin/env bash
// 2>/dev/null; exec node "$0" "$@"
//
// Operator script to block or unblock a user on a private openGym instance.
//
// Usage:
//   node scripts/block-user.mjs --email user@example.com --key <api-key-with-users-write-scope>
//   node scripts/block-user.mjs --email user@example.com --unblock --key <api-key>

import { Client, Users, Query } from 'node-appwrite'

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

const args = parseArgs()
const endpoint = args.endpoint || process.env.APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1'
const projectId = args.project || process.env.APPWRITE_PROJECT_ID || '6a904b0d003e4351232f'
const apiKey = args.key || process.env.APPWRITE_API_KEY
const email = args.email
const userIdArg = args.user || args.userId
const isUnblock = Boolean(args.unblock)

if (!apiKey) {
  console.error('Error: --key <api-key-with-users-write-scope> is required.')
  console.error('Example: node scripts/block-user.mjs --email user@example.com --key secret-key')
  process.exit(1)
}

if (!email && !userIdArg) {
  console.error('Error: Either --email <email> or --user <userId> is required.')
  process.exit(1)
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey)

const users = new Users(client)

async function main() {
  let targetUser = null

  if (userIdArg) {
    targetUser = await users.get(userIdArg).catch((e) => {
      console.error(`Error: User ID ${userIdArg} not found.`)
      process.exit(1)
    })
  } else {
    const list = await users.list([Query.equal('email', email)]).catch(() => ({ total: 0, users: [] }))
    if (list.total === 0) {
      console.error(`Error: No user found with email ${email}.`)
      process.exit(1)
    }
    targetUser = list.users[0]
  }

  const newStatus = isUnblock ? true : false
  const actionLabel = isUnblock ? 'Unblocking' : 'Blocking'
  console.log(`${actionLabel} user ${targetUser.email} (ID: ${targetUser.$id})...`)

  const updated = await users.updateStatus(targetUser.$id, newStatus)

  console.log('')
  if (updated.status) {
    console.log(`✅ User ${updated.email} is now ACTIVE (Unblocked).`)
  } else {
    console.log(`🚫 User ${updated.email} is now BLOCKED. Active sessions are terminated and login is prohibited.`)
  }
}

main().catch((err) => {
  console.error('Error updating user status:', err.message || err)
  process.exit(1)
})
