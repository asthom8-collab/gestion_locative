import { leasesRepository, CreateLeaseInput, UpdateLeaseInput } from '../repositories/leases'
import { AppError } from '../middlewares/errorHandler'
import { prisma } from '../lib/prisma'
import { tenantsService } from './tenants'

export const leasesService = {
  async getAll(userId: string) {
    return leasesRepository.findAll(userId)
  },

  async getByProperty(propertyId: string, userId: string) {
    return leasesRepository.findByProperty(propertyId, userId)
  },

  async getById(id: string, userId: string) {
    const lease = await leasesRepository.findById(id, userId)
    if (!lease) throw new AppError(404, 'Bail introuvable')
    return lease
  },

  /** Le bien doit appartenir à l'utilisateur, et le locataire lui être visible (404 sinon). */
  async create(data: CreateLeaseInput, userId: string) {
    const [property, tenant] = await Promise.all([
      prisma.property.findFirst({ where: { id: data.propertyId, ownerships: { some: { userId } } }, select: { id: true } }),
      tenantsService.getById(data.tenantId, userId).catch(() => null),
    ])
    if (!property) throw new AppError(404, 'Bien introuvable')
    if (!tenant) throw new AppError(404, 'Locataire introuvable')
    const existing = await prisma.lease.findFirst({
      where: { propertyId: data.propertyId, active: true },
    })
    if (existing) throw new AppError(409, 'Ce bien a déjà un bail actif')
    return leasesRepository.create(data)
  },

  async update(id: string, userId: string, data: UpdateLeaseInput) {
    await leasesService.getById(id, userId)
    return leasesRepository.update(id, data)
  },

  async terminate(id: string, userId: string, endDate: Date) {
    const lease = await leasesService.getById(id, userId)
    if (!lease.active) throw new AppError(409, 'Ce bail est déjà résilié')
    if (endDate < lease.startDate) throw new AppError(400, 'La date de fin ne peut pas précéder le début du bail')
    return leasesRepository.terminate(id, endDate)
  },
}
