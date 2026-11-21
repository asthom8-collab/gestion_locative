import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { api, resetDb, prisma, createProperty, createTenant, createLease, createUser } from './helpers'
import { DEV_USER_ID } from '../src/lib/devUser'
import { notificationsService } from '../src/services/notifications'
import { notifiers } from '../src/lib/notifiers'

beforeEach(async () => {
  await resetDb()
  vi.restoreAllMocks()
  delete process.env.SMTP_HOST
})
afterAll(() => prisma.$disconnect())

const IRL = { irlReference: 140, irlQuarter: 2, irlYear: 2024 }
const run = (date: string) => notificationsService.runRevisionReminders(new Date(date))
const notifs = (userId: string) => prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })

async function setup(owners?: unknown) {
  const p = await createProperty({ name: 'Studio Gare' })
  const t = await createTenant({ firstName: 'Léa', lastName: 'Martin' })
  const lease = await createLease(p.id, t.id, { startDate: '2025-01-01T00:00:00.000Z', ...IRL })
  await api().put('/api/irl').send({ quarter: 2, year: 2025, value: 145 }).expect(200)
  if (owners) await api().put(`/api/properties/${p.id}/owners`).send({ owners }).expect(200)
  return { p, lease }
}

describe('rappels de révision', () => {
  it('prévient chaque propriétaire selon son délai, avec sa quote-part, une seule fois', async () => {
    const claire = await createUser()
    await prisma.user.update({ where: { id: claire.id }, data: { notifyDaysBefore: 30 } })
    const { lease } = await setup([{ userId: DEV_USER_ID, share: 0.6 }, { userId: claire.id, share: 0.4 }])

    await run('2025-10-01') // 92 jours avant : trop tôt
    expect(await prisma.notification.count()).toBe(0)

    expect(await run('2025-11-15')).toEqual({ created: 1 }) // 47 jours : seulement l'administrateur (60 jours)
    const [n] = await notifs(DEV_USER_ID)
    expect(n).toMatchObject({ kind: 'REVISION_UPCOMING', leaseId: lease.id, title: 'Révision du loyer à préparer : Léa Martin', link: `/leases/${lease.id}` })
    expect(n.dueDate!.toISOString().slice(0, 10)).toBe('2026-01-01')
    expect(n.body).toContain('01/01/2026, dans 47 jours')
    expect(n.body).toContain('Loyer révisé maximum : 828,57 €')
    expect(n.body).toContain('Votre quote-part (60 %) : 480,00 € → 497,14 €, soit +17,14 € par mois')
    expect(n.body).toContain('Copropriétaires prévenus : Claire Copro (40 %)')
    expect(await notifs(claire.id)).toHaveLength(0)

    expect(await run('2025-12-05')).toEqual({ created: 1 }) // 27 jours : Claire aussi
    expect((await notifs(claire.id))[0].body).toContain('Votre quote-part (40 %)')
    expect(await run('2025-12-20')).toEqual({ created: 0 }) // pas de doublon
  })

  it('prévient les propriétaires à la date anniversaire (changement de propriétaire)', async () => {
    const claire = await createUser()
    await setup([
      { userId: DEV_USER_ID, share: 1, endDate: '2025-12-15' },
      { userId: claire.id, share: 1, startDate: '2025-12-16' },
    ])
    await run('2025-11-15')
    expect(await notifs(DEV_USER_ID)).toHaveLength(0)
    const [n] = await notifs(claire.id)
    expect(n.body).not.toContain('quote-part')
  })

  it('signale l’indice manquant, et ignore un bail terminé avant l’anniversaire', async () => {
    const { lease } = await setup()
    await prisma.irlIndex.deleteMany()
    await run('2025-12-01')
    expect((await notifs(DEV_USER_ID))[0].body).toContain('L’indice IRL du T2 2025 n’est pas encore saisi')

    const t = await createTenant({ firstName: 'Paul', lastName: 'Durand', email: 'paul@exemple.fr' })
    const p2 = await createProperty({ name: 'T2' })
    const ended = await createLease(p2.id, t.id, { startDate: '2025-01-01T00:00:00.000Z', endDate: '2025-12-20T00:00:00.000Z', ...IRL })
    await run('2025-12-02')
    expect((await notifs(DEV_USER_ID)).map((x) => x.leaseId)).toEqual([lease.id])
    expect(ended.id).toBeTruthy()
  })

  it('envoie sur les canaux configurés et note l’envoi', async () => {
    const ntfy = vi.spyOn(notifiers, 'ntfy').mockResolvedValue()
    const email = vi.spyOn(notifiers, 'email').mockResolvedValue()
    process.env.SMTP_HOST = 'smtp.exemple.fr'
    await prisma.user.update({ where: { id: DEV_USER_ID }, data: { ntfyTopic: 'mon-sujet' } })
    await setup()
    await run('2025-12-01')
    expect(ntfy).toHaveBeenCalledWith('mon-sujet', expect.objectContaining({ title: 'Révision du loyer à préparer : Léa Martin' }))
    expect(email).toHaveBeenCalledWith('admin@local.dev', expect.anything())
    const [n] = await notifs(DEV_USER_ID)
    expect(n.emailSentAt).not.toBeNull()
    expect(n.phoneSentAt).not.toBeNull()
  })
})

describe('/api/notifications', () => {
  it('liste, marque comme lu, isole les notifications de chacun', async () => {
    await setup()
    await run('2025-12-01')
    const [n] = (await api().get('/api/notifications').expect(200)).body
    expect(n).toMatchObject({ title: 'Révision du loyer à préparer : Léa Martin', readAt: null })
    const other = await createUser()
    expect((await api(other.cookie).get('/api/notifications').expect(200)).body).toEqual([])
    await api(other.cookie).post(`/api/notifications/${n.id}/read`).expect(404)
    await api().post(`/api/notifications/${n.id}/read`).expect(204)
    expect((await api().get('/api/notifications')).body[0].readAt).not.toBeNull()
    await api().post('/api/notifications/read-all').expect(204)
  })

  it('essai : résultat de chaque canal', async () => {
    vi.spyOn(notifiers, 'ntfy').mockResolvedValue()
    vi.spyOn(notifiers, 'freeMobile').mockRejectedValue(new Error('SMS Free Mobile : service non activé'))
    await api().patch('/api/me').send({ ntfyTopic: 'mon-sujet', freeMobileUser: '12345678', freeMobileKey: 'cle' }).expect(200)
    const res = await api().post('/api/notifications/test').expect(200)
    expect(res.body).toEqual({ email: 'not_configured', ntfy: 'sent', sms: { error: 'SMS Free Mobile : service non activé' } })
    expect((await api().get('/api/notifications')).body[0].title).toBe('Notification d’essai')
  })

  it('préférences dans le profil, sans exposer la clé SMS', async () => {
    const res = await api().patch('/api/me').send({ notifyDaysBefore: 45, notifyEmail: false, freeMobileUser: '12345678', freeMobileKey: 'secret' }).expect(200)
    expect(res.body).toMatchObject({ notifyDaysBefore: 45, notifyEmail: false, freeMobileUser: '12345678', hasFreeMobileKey: true })
    expect(res.body).not.toHaveProperty('freeMobileKey')
    expect((await api().get('/api/me')).body).not.toHaveProperty('freeMobileKey')
    await api().patch('/api/me').send({ notifyDaysBefore: 0 }).expect(400)
    await api().patch('/api/me').send({ ntfyTopic: 'avec espace' }).expect(400)
    expect((await api().patch('/api/me').send({ freeMobileKey: '' }).expect(200)).body.hasFreeMobileKey).toBe(false)
  })
})
