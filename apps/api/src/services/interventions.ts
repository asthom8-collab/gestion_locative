import { AppError } from '../middlewares/errorHandler'
import { taxTreatment } from '../lib/interventionTax'
import { round2 } from '../lib/period'
import { InterventionData, InterventionFilter, InterventionWithLinks, interventionsRepository } from '../repositories/interventions'

export type InterventionInput = Omit<InterventionData, 'date'> & { date: string }

/** Ajoute le traitement fiscal calculé selon le régime du bien. */
const present = (i: InterventionWithLinks) => ({ ...i, tax: taxTreatment(i, i.property.fiscalRegime, i.property.type) })

async function getOrThrow(id: string, userId: string) {
  const intervention = await interventionsRepository.findById(id, userId)
  if (!intervention) throw new AppError(404, 'Intervention introuvable')
  return intervention
}

/** Le bail facultatif doit être un bail de l'utilisateur, sur le même bien. */
async function checkLease(leaseId: string | null | undefined, propertyId: string, userId: string) {
  if (!leaseId) return
  const lease = await interventionsRepository.findLease(leaseId, userId)
  if (!lease) throw new AppError(404, 'Bail introuvable')
  if (lease.propertyId !== propertyId) throw new AppError(400, 'Le bail choisi ne porte pas sur ce bien')
}

/** Champs texte facultatifs : vide → null. */
const clean = <T extends { providerName?: string | null; notes?: string | null }>(d: T) => ({
  ...d,
  ...('providerName' in d ? { providerName: d.providerName?.trim() || null } : {}),
  ...('notes' in d ? { notes: d.notes?.trim() || null } : {}),
})

export const interventionsService = {
  /** Liste filtrée, avec les totaux : dépenses du propriétaire (faites) et montant à déclarer selon les régimes. */
  async list(filter: InterventionFilter) {
    const items = (await interventionsRepository.findMany(filter)).map(present)
    const done = items.filter((i) => i.status === 'DONE' && i.paidBy === 'OWNER')
    return {
      items,
      totals: {
        ownerCost: round2(done.reduce((s, i) => s + i.cost, 0)),
        deductible: round2(items.filter((i) => i.tax.code === 'DEDUCTIBLE').reduce((s, i) => s + i.tax.amount, 0)),
        depreciable: round2(items.filter((i) => i.tax.code === 'DEPRECIABLE').reduce((s, i) => s + i.tax.amount, 0)),
        planned: round2(items.filter((i) => i.status === 'PLANNED').reduce((s, i) => s + i.cost, 0)),
      },
      years: await interventionsRepository.years(filter.userId),
    }
  },

  async get(id: string, userId: string) {
    return present(await getOrThrow(id, userId))
  },

  async create(userId: string, data: InterventionInput) {
    if (!(await interventionsRepository.propertyExists(data.propertyId, userId))) throw new AppError(404, 'Bien introuvable')
    await checkLease(data.leaseId, data.propertyId, userId)
    return present(await interventionsRepository.create(clean({ ...data, date: new Date(data.date) })))
  },

  async update(id: string, userId: string, data: Partial<Omit<InterventionInput, 'propertyId'>>) {
    const before = await getOrThrow(id, userId)
    if (data.leaseId !== undefined) await checkLease(data.leaseId, before.propertyId, userId)
    const { date, ...rest } = data
    return present(await interventionsRepository.update(id, clean({ ...rest, ...(date ? { date: new Date(date) } : {}) })))
  },

  /** Les factures et devis restent dans les documents du bien. */
  async remove(id: string, userId: string) {
    await getOrThrow(id, userId)
    await interventionsRepository.delete(id)
  },
}
