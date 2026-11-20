import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * URL de la base de test :
 * - TEST_DATABASE_URL si elle est définie (CI) ;
 * - sinon DATABASE_URL (lue dans apps/api/.env) avec le nom de base suffixé par "_test".
 * Par sécurité, le nom de la base doit se terminer par "_test" (les tests vident les tables).
 */
export function resolveTestDatabaseUrl(): string {
  if (!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL) {
    const envFile = resolve(__dirname, '../.env')
    if (existsSync(envFile)) process.loadEnvFile(envFile)
  }

  const raw = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
  if (!raw) throw new Error('DATABASE_URL ou TEST_DATABASE_URL est requise pour lancer les tests')

  const url = new URL(raw)
  const dbName = url.pathname.replace(/^\//, '')
  if (!process.env.TEST_DATABASE_URL && !dbName.endsWith('_test')) {
    url.pathname = `/${dbName}_test`
  }
  if (!url.pathname.endsWith('_test')) {
    throw new Error(`Base de test refusée (${url.pathname}) : son nom doit se terminer par "_test"`)
  }
  return url.toString()
}
