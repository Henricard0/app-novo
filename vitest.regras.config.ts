import { defineConfig } from 'vitest/config'

// Testes das regras de segurança do Firestore. Rodam contra o emulador:
// npm run test:regras (sobe o emulador, roda e desliga).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/regras/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
})
