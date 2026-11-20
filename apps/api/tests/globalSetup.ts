import { execSync } from 'node:child_process'

// Crée la base de test si besoin et applique les migrations (une fois par lancement)
export default function setup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: process.env,
    cwd: `${__dirname}/..`,
  })
}
