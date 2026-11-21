import { readFile } from 'node:fs/promises'
import { AppError } from '../middlewares/errorHandler'
import { storagePath } from '../lib/storage'
import type { Landlord } from '../lib/pdfCommon'

type Owner = { firstName: string; lastName: string; address: string | null; zipCode: string | null; city: string | null; signaturePath: string | null }

/** Bailleurs d'un bien pour un document (quittance, courrier) : adresse obligatoire, signature facultative. */
export async function landlordsFor(ownerships: { user: Owner }[]): Promise<Landlord[]> {
  const owners = ownerships.map((o) => o.user)
  if (!owners.length) throw new AppError(409, 'Ce bien n’a pas de propriétaire')
  const incomplete = owners.find((u) => !u.address || !u.zipCode || !u.city)
  if (incomplete) {
    throw new AppError(409, `Adresse du bailleur manquante (${incomplete.firstName} ${incomplete.lastName}) : complétez-la dans Paramètres`)
  }
  // Fichier de signature manquant = pas de signature
  const signatures = await Promise.all(owners.map((u) =>
    u.signaturePath ? readFile(storagePath(u.signaturePath)).catch(() => undefined) : Promise.resolve(undefined)))
  return owners.map((u, i) => ({
    name: `${u.firstName} ${u.lastName}`, address: u.address!, zipCode: u.zipCode!, city: u.city!, signature: signatures[i],
  }))
}

/** Inclusion Prisma des propriétaires d'un bien, dans l'ordre d'ajout. */
export const ownershipsWithUsers = { include: { user: true }, orderBy: { createdAt: 'asc' } } as const
