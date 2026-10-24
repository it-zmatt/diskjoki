import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fetchProxy } from './server/fetchProxy.ts'

// ffmpeg.wasm needs a cross-origin isolated page (SharedArrayBuffer).
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [react(), fetchProxy()],
  // Pre-bundling breaks the worker that @ffmpeg/ffmpeg spawns.
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
})
