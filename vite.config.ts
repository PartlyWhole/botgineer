import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

/**
 * `VITE_BASE` sets the deployment base path. A GitHub *project* site lives at
 * https://OWNER.github.io/REPOSITORY/, so every asset, worker and runtime URL
 * has to be prefixed. The Pages workflow sets this from the repository name;
 * local dev defaults to '/'.
 */
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
  // Which build this is: the commit, on a deploy. Peers in a shared room
  // compare it, since two builds may not understand each other's messages
  // (`collab/room`).
  define: {
    'import.meta.env.VITE_BUILD': JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev'),
  },
  resolve: {
    alias: [
      // Automerge's browser entry imports its .wasm as a module, which
      // needs a bundler plugin. The base64 entry carries the wasm inline
      // and initialises itself, and it only loads when a shared room
      // starts (`src/collab/`), so solo players never fetch it.
      {
        find: /^@automerge\/automerge$/,
        replacement: fileURLToPath(new URL('./node_modules/@automerge/automerge/dist/mjs/entrypoints/fullfat_base64.js', import.meta.url)),
      },
    ],
  },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 900,
  },
})
