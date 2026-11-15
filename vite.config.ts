import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
    env: {
      VITE_FIREBASE_PROJECT_ID: 'demo-triade',
      VITE_FIREBASE_API_KEY: 'chave-de-teste',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-triade.firebaseapp.com',
      VITE_FIREBASE_APP_ID: 'app-de-teste',
    },
  },
})
