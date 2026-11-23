import { compare, hash } from 'bcrypt'
import { Role } from '@prisma/client'
import { AppError } from '../middlewares/errorHandler'
import { UpdateProfileInput, usersRepository } from '../repositories/users'
import { removeFile, saveFile, storagePath } from '../lib/storage'

const BCRYPT_ROUNDS = 12
// Hash d'un mot de passe quelconque : la vérification d'un e-mail inconnu prend le même temps
const DUMMY_HASH = '$2b$12$VkBv5WJs4PV2ZYkUywOrs.izQ.ZNnx4Wu.q8RFoSDGFaRWo/BDGRq'

/** Le profil ne montre ni le chemin du fichier de signature ni la clé SMS, seulement s'ils existent. */
function present<T extends { signaturePath: string | null; freeMobileKey: string | null }>({ signaturePath, freeMobileKey, ...u }: T) {
  return { ...u, hasSignature: signaturePath !== null, hasFreeMobileKey: freeMobileKey !== null }
}

const SIGNATURE_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg' }
const MAX_SIGNATURE_BYTES = 300 * 1024

export const usersService = {
  async getProfile(id: string) {
    const user = await usersRepository.findById(id)
    if (!user) throw new AppError(404, 'Utilisateur introuvable')
    return present(user)
  },

  async updateProfile(id: string, data: UpdateProfileInput) {
    const current = await usersService.getProfile(id)
    if (data.email !== undefined && data.email !== current.email && await usersRepository.existsByEmail(data.email)) {
      throw new AppError(409, 'Un compte existe déjà avec cet e-mail')
    }
    return present(await usersRepository.update(id, data))
  },

  /** Renvoie l'id et la version de session si l'e-mail et le mot de passe sont bons, sinon une 401 générique. */
  async authenticate(email: string, password: string) {
    const user = await usersRepository.findCredentials(email.toLowerCase())
    const ok = await compare(password, user?.passwordHash ?? DUMMY_HASH)
    if (!user || !ok) throw new AppError(401, 'E-mail ou mot de passe incorrect')
    return user
  },

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await usersRepository.findPasswordHash(id)
    if (!user || !(await compare(currentPassword, user.passwordHash)))
      throw new AppError(400, 'Mot de passe actuel incorrect')
    if (currentPassword === newPassword) throw new AppError(400, 'Le nouveau mot de passe doit être différent')
    return usersRepository.setPassword(id, await hash(newPassword, BCRYPT_ROUNDS), false)
  },

  /**
   * Annuaire : l'administrateur voit tous les comptes (et leur rôle) ; un propriétaire ne voit que lui-même et
   * les copropriétaires de ses biens.
   */
  directory: (userId: string, role: Role) => (role === 'ADMIN' ? usersRepository.directory() : usersRepository.coOwners(userId)),

  /** Change le rôle d'un compte ; on ne change pas le sien (pas de risque de perdre le dernier administrateur). */
  async setRole(adminId: string, id: string, role: Role) {
    if (id === adminId) throw new AppError(400, 'Vous ne pouvez pas changer votre propre rôle')
    await usersService.getProfile(id)
    return usersRepository.setRole(id, role)
  },

  /** Compte créé par un administrateur : mot de passe provisoire, à changer à la première connexion. */
  async createUser(data: { email: string; firstName: string; lastName: string; password: string; role?: Role }) {
    const email = data.email.toLowerCase()
    if (await usersRepository.existsByEmail(email)) throw new AppError(409, 'Un compte existe déjà avec cet e-mail')
    return present(await usersRepository.create({
      email, firstName: data.firstName, lastName: data.lastName, role: data.role ?? 'USER',
      passwordHash: await hash(data.password, BCRYPT_ROUNDS),
    }))
  },

  async resetPassword(id: string, password: string) {
    await usersService.getProfile(id)
    await usersRepository.setPassword(id, await hash(password, BCRYPT_ROUNDS), true)
  },

  /** Signature envoyée en data URL (PNG ou JPEG, 300 Ko au plus). */
  async setSignature(id: string, dataUrl: string) {
    const m = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
    if (!m) throw new AppError(400, 'La signature doit être une image PNG ou JPEG')
    const content = Buffer.from(m[2], 'base64')
    if (content.length > MAX_SIGNATURE_BYTES) throw new AppError(400, 'Image trop lourde (300 Ko au plus)')
    // Vérifie la signature binaire du fichier, pas seulement le type annoncé
    const isPng = content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    const isJpeg = content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff
    if ((m[1] === 'image/png' && !isPng) || (m[1] === 'image/jpeg' && !isJpeg))
      throw new AppError(400, 'Le fichier ne correspond pas à une image PNG ou JPEG')
    const previous = (await usersRepository.findById(id))?.signaturePath
    const path = `signatures/${id}.${SIGNATURE_TYPES[m[1]]}`
    await saveFile(path, content)
    if (previous && previous !== path) await removeFile(previous)
    return present(await usersRepository.setSignature(id, path))
  },

  async deleteSignature(id: string) {
    const previous = (await usersRepository.findById(id))?.signaturePath
    if (previous) await removeFile(previous)
    return present(await usersRepository.setSignature(id, null))
  },

  async signatureFile(id: string) {
    const path = (await usersRepository.findById(id))?.signaturePath
    if (!path) throw new AppError(404, 'Pas de signature enregistrée')
    return storagePath(path)
  },
}
