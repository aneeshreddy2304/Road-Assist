import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
