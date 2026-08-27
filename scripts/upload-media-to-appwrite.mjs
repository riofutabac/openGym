#!/usr/bin/env node
// CLI script to upload exercise GIFs/images to Appwrite Storage bucket
//
// Usage:
//   node scripts/upload-media-to-appwrite.mjs \
//     --endpoint https://sfo.cloud.appwrite.io/v1 \
//     --project 6a904b0d003e4351232f \
//     --key <api-key-with-storage-scope> \
//     --bucket exercises \
//     --dir ./media/gif

import fs from 'node:fs'
import path from 'node:path'
import { Client, Storage, Permission, Role, Query } from 'node-appwrite'
// node-appwrite 14 moved InputFile to its own subpath export.
import { InputFile } from 'node-appwrite/file'

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
const bucketId = args.bucket || 'exercises'
const targetDir = path.resolve(args.dir || './media/gif')

if (!apiKey) {
  console.error('Error: --key <api-key-with-files-write-scope> is required.')
  console.error('Example: node scripts/upload-media-to-appwrite.mjs --key secret-key --dir ./media/gif')
  process.exit(1)
}

if (!fs.existsSync(targetDir)) {
  console.error(`Error: Media directory not found at ${targetDir}`)
  process.exit(1)
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey)

const storage = new Storage(client)

const sanitizeFileId = (filename) => {
  const base = path.parse(filename).name
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 36)
}

async function run() {
  console.log(`\n📦 Starting Media Upload to Appwrite Storage`)
  console.log(`• Endpoint:  ${endpoint}`)
  console.log(`• Project:   ${projectId}`)
  console.log(`• Bucket:    ${bucketId}`)
  console.log(`• Directory: ${targetDir}`)

  const files = fs.readdirSync(targetDir).filter(f => !f.startsWith('.'))
  console.log(`• Total files to verify/upload: ${files.length}\n`)

  let uploaded = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < files.length; i++) {
    const filename = files[i]
    const fullPath = path.join(targetDir, filename)
    const fileId = sanitizeFileId(filename)

    process.stdout.write(`\r[${i + 1}/${files.length}] Checking ${filename}... `)

    try {
      // Check if file already exists
      await storage.getFile(bucketId, fileId)
      skipped++
    } catch (err) {
      if (err.code === 404 || err.status === 404) {
        // Upload new file with public read permissions
        try {
          const inputFile = InputFile.fromPath(fullPath, filename)
          await storage.createFile(
            bucketId,
            fileId,
            inputFile,
            [Permission.read(Role.any())]
          )
          uploaded++
        } catch (uploadErr) {
          failed++
          console.error(`\n❌ Failed to upload ${filename}: ${uploadErr.message}`)
        }
      } else {
        failed++
        console.error(`\n❌ Error checking ${filename}: ${err.message}`)
      }
    }
  }

  console.log(`\n\n📊 Upload Summary:`)
  console.log(`  • Uploaded: ${uploaded}`)
  console.log(`  • Skipped (Already existed): ${skipped}`)
  console.log(`  • Failed:   ${failed}`)

  // Verification: page through the bucket for real and compare counts.
  // listFiles() without queries returns only the first default page, so a loop that
  // re-calls it unchanged counts the same page forever and proves nothing.
  console.log(`\n🔍 Verifying remote storage count...`)
  let remoteCount = 0
  let lastId = null

  try {
    for (;;) {
      const queries = [Query.limit(100)]
      if (lastId) queries.push(Query.cursorAfter(lastId))
      const res = await storage.listFiles(bucketId, queries)
      const page = res.files || []
      remoteCount += page.length
      if (page.length < 100) break
      lastId = page[page.length - 1].$id
    }
  } catch (verErr) {
    console.error(`❌ Failed to list remote files: ${verErr.message}`)
    process.exit(1)
  }

  console.log(`• Remote bucket count: ${remoteCount}`)
  console.log(`• Local source count:  ${files.length}`)

  // The count comparison is the whole point of the verification: a run that uploaded
  // without error but left the bucket short must not report success.
  if (failed > 0) {
    console.error(`\n❌ ${failed} file(s) failed to upload.\n`)
    process.exit(1)
  }
  if (remoteCount < files.length) {
    console.error(`\n❌ Bucket holds ${remoteCount} files but the source has ${files.length}.\n`)
    process.exit(1)
  }

  console.log(`\n✅ Upload verified: ${remoteCount} files in the bucket.\n`)
  process.exit(0)
}

run().catch(err => {
  console.error('\nFatal error:', err)
  process.exit(1)
})
