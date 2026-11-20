import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

// Fichiers générés (quittances, documents…) : chemins relatifs à STORAGE_PATH stockés en base
export const storageRoot = () => resolve(process.env.STORAGE_PATH ?? './storage')

export const storagePath = (relativePath: string) => resolve(storageRoot(), relativePath)

export async function saveFile(relativePath: string, content: Buffer) {
  const target = storagePath(relativePath)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, content)
}

export async function removeFile(relativePath: string) {
  await rm(storagePath(relativePath), { force: true })
}
