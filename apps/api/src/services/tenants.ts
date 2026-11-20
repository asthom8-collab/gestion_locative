import { tenantsRepository, CreateTenantInput, UpdateTenantInput } from '../repositories/tenants'
import { AppError } from '../middlewares/errorHandler'

export const tenantsService = {
  async getAll(userId: string) {
    return tenantsRepository.findAll(userId)
  },

  async getById(id: string, userId: string) {
    const tenant = await tenantsRepository.findById(id, userId)
    if (!tenant) throw new AppError(404, 'Locataire introuvable')
    return tenant
  },

  async create(data: CreateTenantInput, userId: string) {
    return tenantsRepository.create(data, userId)
  },

  async update(id: string, userId: string, data: UpdateTenantInput) {
    await tenantsService.getById(id, userId)
    return tenantsRepository.update(id, data)
  },

  async delete(id: string, userId: string) {
    const tenant = await tenantsService.getById(id, userId)
    if (tenant.leases.some((l) => l.active))
      throw new AppError(409, 'Impossible de supprimer un locataire avec un bail actif')
    // Y compris les baux chez un autre propriétaire, que l'utilisateur ne voit pas
    if ((await tenantsRepository.countLeases(id)) > 0)
      throw new AppError(409, 'Impossible de supprimer un locataire qui a un historique de baux')
    return tenantsRepository.delete(id)
  },
}
