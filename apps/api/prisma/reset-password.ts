/**
 * Réinitialise le mot de passe d'un compte (par exemple un administrateur qui ne peut plus se connecter),
 * dans la base de DATABASE_URL. Affiche un mot de passe provisoire : il faudra le changer à la connexion,
 * et les sessions ouvertes sur ce compte sont fermées.
 *   npm run reset-password -- <email>
 * Sans e-mail, liste les comptes existants.
 */
import { randomBytes } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { usersService } from '../src/services/users'

const prisma = new PrismaClient()
// Sans caractères ambigus (0/O, 1/l/I) pour pouvoir le recopier à la main
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'

function provisionalPassword(length = 12) {
  const out: string[] = []
  // Rejet des octets au-delà du plus grand multiple de la taille de l'alphabet : tirage sans biais
  const limit = 256 - (256 % ALPHABET.length)
  while (out.length < length) {
    for (const b of randomBytes(length)) if (b < limit && out.length < length) out.push(ALPHABET[b % ALPHABET.length])
  }
  return out.join('')
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()
  if (!email) {
    const users = await prisma.user.findMany({ select: { email: true, role: true }, orderBy: { createdAt: 'asc' } })
    console.log('Usage : npm run reset-password -- <email>\nComptes :')
    for (const u of users) console.log(`  ${u.email} (${u.role === 'ADMIN' ? 'administrateur' : 'propriétaire'})`)
    process.exitCode = 1
    return
  }
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error(`Aucun compte avec l'e-mail ${email}`)
    process.exitCode = 1
    return
  }
  const password = provisionalPassword()
  await usersService.resetPassword(user.id, password)
  console.log(`Compte : ${user.email}\nMot de passe provisoire : ${password}\n(à changer à la prochaine connexion)`)
}

main().finally(() => prisma.$disconnect())
