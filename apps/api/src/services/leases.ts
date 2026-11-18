import { leasesRepository, CreateLeaseInput, UpdateLeaseInput } from '../repositories/leases'
import { AppError } from '../middlewares/errorHandler'
import { prisma } from '../lib/prisma'

export const leasesService = {
  async getAll() {
    return leasesRepository.findAll()
  },

  async getByProperty(propertyId: string) {
    return leasesRepository.findByProperty(propertyId)
  },

  async getById(id: string) {
    const lease = await leasesRepository.findById(id)
    if (!lease) throw new AppError(404, 'Bail introuvable')
    return lease
  },

  async create(data: CreateLeaseInput) {
    const existing = await prisma.lease.findFirst({
      where: { propertyId: data.propertyId, active: true },
    })
    if (existing) throw new AppError(409, 'Ce bien a déjà un bail actif')
    return leasesRepository.create(data)
  },

  async update(id: string, data: UpdateLeaseInput) {
    await leasesService.getById(id)
    return leasesRepository.update(id, data)
  },

  async terminate(id: string, endDate: Date) {
    const lease = await leasesService.getById(id)
    if (!lease.active) throw new AppError(409, 'Ce bail est déjà résilié')
    return leasesRepository.terminate(id, endDate)
  },
}
