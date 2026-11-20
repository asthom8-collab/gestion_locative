import { AppError } from '../middlewares/errorHandler'
import { UpdateProfileInput, usersRepository } from '../repositories/users'

export const usersService = {
  async getProfile(id: string) {
    const user = await usersRepository.findById(id)
    if (!user) throw new AppError(404, 'Utilisateur introuvable')
    return user
  },

  async updateProfile(id: string, data: UpdateProfileInput) {
    await usersService.getProfile(id)
    return usersRepository.update(id, data)
  },
}
