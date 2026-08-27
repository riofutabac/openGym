import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// No dev proxy any more. /api belonged to the Node backend retired in milestone 3, and
// /img + /gif pointed at the media container retired in milestone 4 — both left every
// image request answering 502 in `npm run dev`. Images now come from public/img, which
// Vite serves directly, and animations come from Appwrite Storage over absolute URLs.

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { chunkSizeWarningLimit: 1500 }
})
