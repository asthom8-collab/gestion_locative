import { defineConfig } from 'vitest/config'
import { resolveTestDatabaseUrl } from './tests/testDatabase'

// Les tests tournent sur une base dédiée (<base>_test), jamais sur la base de dev.
process.env.DATABASE_URL = resolveTestDatabaseUrl()
process.env.NODE_ENV = 'test'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    // Une seule base partagée : les fichiers de test s'exécutent l'un après l'autre
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 60_000,
  },
})
