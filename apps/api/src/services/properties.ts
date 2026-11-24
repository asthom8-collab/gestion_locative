import { documentsService } from './documents'
import { checkTimeline } from '../lib/ownership'
import { propertiesRepository, CreatePropertyInput, UpdatePropertyInput } from '../repositories/properties'
import { AppError } from '../middlewares/errorHandler'

type OwnerInput = { userId: string; share: number; startDate?: Date | null; endDate?: Date | null }

export const propertiesService = {
  async getAll(userId: string) {
    return propertiesRepository.findAll(userId)
  },

  async getById(id: string, userId: string) {
    const property = await propertiesRepository.findById(id, userId)
    if (!property) throw new AppError(404, 'Bien introuvable')
    return property
  },

  async create(data: CreatePropertyInput) {
    return propertiesRepository.create(data)
  },

  async update(id: string, userId: string, data: UpdatePropertyInput) {
    await propertiesService.getById(id, userId)
    return propertiesRepository.update(id, data)
  },

  /**
   * Copropriétaires du bien : mêmes droits pour tous. On ne peut pas se retirer soi-même
   * (on perdrait l'accès au bien) ; à chaque date, la somme des quotes-parts doit faire 100 %.
   * Un ancien propriétaire (date de fin passée) garde l'accès au bien, pour son historique.
   */
  async setOwners(id: string, userId: string, input: OwnerInput[]) {
    const owners = input.map((o) => ({ userId: o.userId, share: o.share, startDate: o.startDate ?? null, endDate: o.endDate ?? null }))
    await propertiesService.getById(id, userId)
    const ids = owners.map((o) => o.userId)
    if (new Set(ids).size !== ids.length) throw new AppError(400, 'Un propriétaire apparaît deux fois')
    if (!ids.includes(userId)) throw new AppError(400, 'Vous ne pouvez pas vous retirer vous-même des propriétaires du bien')
    const error = checkTimeline(owners)
    if (error) throw new AppError(400, error)
    if ((await propertiesRepository.countUsers(ids)) !== ids.length) throw new AppError(404, 'Utilisateur introuvable')
    return propertiesRepository.setOwners(id, owners)
  },

  async delete(id: string, userId: string) {
    const property = await propertiesService.getById(id, userId)
    const hasActiveLeases = property.leases.some((l) => l.active)
    if (hasActiveLeases)
      throw new AppError(409, 'Impossible de supprimer un bien avec un bail actif')
    if (property.leases.length > 0)
      throw new AppError(409, 'Impossible de supprimer un bien qui a un historique de baux')
    // Les documents du bien (diagnostics, factures…) partent avec lui
    await documentsService.removeForProperty(id)
    await propertiesRepository.delete(id)
  },
}
