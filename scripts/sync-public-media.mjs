#!/usr/bin/env node
// Copies the exercise JPGs into the frontend's public/ folder so Vite bundles them
// into dist (and from there into the APK via `cap sync`).
//
// This is a build step and not a committed copy on purpose: media/img is already
// tracked in this repo, so checking the same 1324 files in twice would leave two
// copies to keep in sync. frontend/public/img is gitignored and regenerated here.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'media', 'img')
const dest = path.join(root, 'frontend', 'public', 'img')

if (!fs.existsSync(src)) {
  console.error(`[sync-public-media] Source not found: ${src}`)
  console.error('[sync-public-media] Run scripts/fetch-media.sh first.')
  process.exit(1)
}

const srcFiles = fs.readdirSync(src).filter(f => !f.startsWith('.'))
const destFiles = fs.existsSync(dest)
  ? fs.readdirSync(dest).filter(f => !f.startsWith('.'))
  : []

if (srcFiles.length === destFiles.length && srcFiles.length > 0) {
  console.log(`[sync-public-media] Up to date (${destFiles.length} images).`)
  process.exit(0)
}

fs.mkdirSync(dest, { recursive: true })
for (const f of srcFiles) fs.copyFileSync(path.join(src, f), path.join(dest, f))
console.log(`[sync-public-media] Copied ${srcFiles.length} images into frontend/public/img.`)
