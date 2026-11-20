import { createHmac, timingSafeEqual } from 'node:crypto'
import type { CookieOptions, Request } from 'express'

/**
 * Sessions sans état : le cookie contient l'id de l'utilisateur, la version de session et l'expiration,
 * signés en HMAC-SHA256 avec SESSION_SECRET. La version (User.sessionVersion) est vérifiée à chaque
 * requête : la changer (changement de mot de passe) invalide toutes les sessions ouvertes.
 */
export const SESSION_COOKIE = 'gl_session'
const TTL_MS = 30 * 24 * 3600 * 1000 // 30 jours

const DEV_SECRET = 'dev-secret-a-ne-pas-utiliser-en-production'

function secret() {
  const s = process.env.SESSION_SECRET
  if (s && s.length >= 32) return s
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET (32 caractères minimum) est obligatoire en production')
  return DEV_SECRET
}

/** À appeler au démarrage : échoue tout de suite si la configuration est incomplète en production. */
export const checkAuthConfig = () => void secret()

type Payload = { uid: string; v: number; exp: number }

const sign = (data: string) => createHmac('sha256', secret()).update(data).digest('base64url')

export function createSessionToken(userId: string, version: number, now = Date.now()) {
  const data = Buffer.from(JSON.stringify({ uid: userId, v: version, exp: now + TTL_MS } satisfies Payload)).toString('base64url')
  return `${data}.${sign(data)}`
}

export function readSessionToken(token: string | undefined, now = Date.now()): Payload | null {
  if (!token) return null
  const [data, mac] = token.split('.')
  if (!data || !mac) return null
  const expected = Buffer.from(sign(data))
  const given = Buffer.from(mac)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const p = JSON.parse(Buffer.from(data, 'base64url').toString()) as Payload
    if (typeof p.uid !== 'string' || typeof p.v !== 'number' || typeof p.exp !== 'number' || p.exp < now) return null
    return p
  } catch {
    return null
  }
}

/** Lecture du cookie de session (pas de dépendance cookie-parser). */
export function sessionCookieFrom(req: Request) {
  const header = req.headers.cookie ?? ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === SESSION_COOKIE) return decodeURIComponent(v.join('='))
  }
  return undefined
}

/** COOKIE_SECURE=true quand l'application est servie en HTTPS. */
export const sessionCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/',
  maxAge: TTL_MS,
})
