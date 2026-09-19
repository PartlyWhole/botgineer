import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 900,
  },
})
