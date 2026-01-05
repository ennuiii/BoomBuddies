import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Game base path for routing
  // Use './' for Capacitor builds (CAPACITOR=true npm run build)
  base: process.env.CAPACITOR ? './' : '/bomberman/',
  plugins: [
    react(),
    // Copy MediaPipe WASM files for virtual background feature
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@mediapipe/tasks-vision/wasm/*',
          dest: 'wasm'
        }
      ]
    })
  ],
  server: {
    // TODO: Change port to avoid conflicts with other games
    port: 5199,
    host: true,
  },
  // Only strip debugger statements in production builds (keep console for debugging)
  esbuild: mode === 'production'
    ? { drop: ['debugger'] }
    : {},
  build: {
    minify: 'esbuild',
    chunkSizeWarningLimit: 600,
  },
}))
