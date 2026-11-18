import { tenantsRepository, CreateTenantInput, UpdateTenantInput } from '../repositories/tenants'
import { AppError } from '../middlewares/errorHandler'

export const tenantsService = {
  async getAll() {
    return tenantsRepository.findAll()
  },

  async getById(id: string) {
    const tenant = await tenantsRepository.findById(id)
    if (!tenant) throw new AppError(404, 'Locataire introuvable')
    return tenant
  },

  async create(data: CreateTenantInput) {
    return tenantsRepository.create(data)
  },

  async update(id: string, data: UpdateTenantInput) {
    await tenantsService.getById(id)
    return tenantsRepository.update(id, data)
  },

  async delete(id: string) {
    const tenant = await tenantsService.getById(id)
    const hasActiveLeases = tenant.leases.some((l) => l.active)
    if (hasActiveLeases)
      throw new AppError(409, 'Impossible de supprimer un locataire avec un bail actif')
    return tenantsRepository.delete(id)
  },
}
