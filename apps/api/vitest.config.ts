import { defineConfig } from 'vitest/config'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveTestDatabaseUrl } from './tests/testDatabase'

// Les tests tournent sur une base dédiée (<base>_test), jamais sur la base de dev.
process.env.DATABASE_URL = resolveTestDatabaseUrl()
process.env.NODE_ENV = 'test'
// Les PDF générés pendant les tests vont dans un dossier temporaire, pas dans storage/
process.env.STORAGE_PATH = join(tmpdir(), 'gestion-locative-test-storage')

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
