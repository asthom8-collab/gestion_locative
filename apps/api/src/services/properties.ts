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

  async delete(id: string, userId: string) {
    const property = await propertiesService.getById(id, userId)
    const hasActiveLeases = property.leases.some((l) => l.active)
    if (hasActiveLeases)
      throw new AppError(409, 'Impossible de supprimer un bien avec un bail actif')
    return propertiesRepository.delete(id)
  },
}
