import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDirectory = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(projectDirectory, 'src/wingman'),
    },
  },
  server: {
    proxy: {
      // During local dev, proxy /api calls to FastAPI
      // (optional — only needed if you want to avoid CORS in dev)
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
