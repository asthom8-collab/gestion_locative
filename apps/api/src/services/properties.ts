import { propertiesRepository, CreatePropertyInput, UpdatePropertyInput } from '../repositories/properties'
import { AppError } from '../middlewares/errorHandler'

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
   * (on perdrait l'accès au bien) ; la somme des quotes-parts doit faire 100 %.
   */
  async setOwners(id: string, userId: string, owners: { userId: string; share: number }[]) {
    await propertiesService.getById(id, userId)
    const ids = owners.map((o) => o.userId)
    if (new Set(ids).size !== ids.length) throw new AppError(400, 'Un propriétaire apparaît deux fois')
    if (!ids.includes(userId)) throw new AppError(400, 'Vous ne pouvez pas vous retirer vous-même des propriétaires du bien')
    const total = owners.reduce((s, o) => s + o.share, 0)
    if (Math.abs(total - 1) > 0.0001) throw new AppError(400, `La somme des quotes-parts doit faire 100 % (actuellement ${Math.round(total * 10000) / 100} %)`)
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
    await propertiesRepository.delete(id)
  },
}
