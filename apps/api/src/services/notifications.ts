import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { AppError } from '../middlewares/errorHandler'
import { daysBetween, round2, toUtcDay } from '../lib/period'
import { day as fmtDay, eur } from '../lib/pdfCommon'
import { ownersAt } from '../lib/ownership'
import { Message, notifiers, smtpConfigured } from '../lib/notifiers'
import { ownershipsWithUsers } from './landlords'
import { computeRevision } from './revisions'

export const REVISION_KIND = 'REVISION_UPCOMING'

type Recipient = { id: string; email: string; notifyEmail: boolean; ntfyTopic: string | null; freeMobileUser: string | null; freeMobileKey: string | null }
type ChannelResult = 'sent' | 'disabled' | 'not_configured' | { error: string }

const appLink = (path: string) => (process.env.APP_URL ? `${process.env.APP_URL.replace(/\/+$/, '')}${path}` : path)
const pct = (share: number) => `${Math.round(share * 10000) / 100} %`

async function attempt(fn: () => Promise<void>): Promise<ChannelResult> {
  try { await fn(); return 'sent' } catch (e) { return { error: e instanceof Error ? e.message : String(e) } }
}

/** Envoie un message sur les canaux externes de l'utilisateur (e-mail, téléphone). */
async function dispatch(user: Recipient, m: Message) {
  const email: ChannelResult = !user.notifyEmail ? 'disabled' : !smtpConfigured() ? 'not_configured' : await attempt(() => notifiers.email(user.email, m))
  const ntfy: ChannelResult = user.ntfyTopic ? await attempt(() => notifiers.ntfy(user.ntfyTopic!, m)) : 'not_configured'
  const sms: ChannelResult = user.freeMobileUser && user.freeMobileKey ? await attempt(() => notifiers.freeMobile(user.freeMobileUser!, user.freeMobileKey!, m)) : 'not_configured'
  for (const [channel, r] of Object.entries({ email, ntfy, sms })) {
    if (typeof r === 'object') console.warn(`Notification ${channel} non envoyée à ${user.id} : ${r.error}`)
  }
  return { email, ntfy, sms }
}

type LeaseForReminder = Prisma.LeaseGetPayload<{ include: { tenant: true; property: { include: { ownerships: typeof ownershipsWithUsers } }; rentRevisions: true } }>

/** Texte du rappel de révision pour un propriétaire, avec sa quote-part. */
function reminderMessage(lease: LeaseForReminder, r: Awaited<ReturnType<typeof computeRevision>>, share: number, coOwners: string[], daysLeft: number): Message {
  const tenant = `${lease.tenant.firstName} ${lease.tenant.lastName}`
  const lines = [
    `Le bail de ${tenant} (${lease.property.name}) arrive à sa date anniversaire le ${fmtDay(r.nextRevisionDate)}, dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''} : c'est le moment de préparer la révision du loyer et de prévenir le locataire.`,
    `Loyer actuel : ${eur(r.currentRent)} hors charges.`,
  ]
  if (r.computedRent != null) {
    const diff = round2(r.computedRent - r.currentRent)
    lines.push(`Loyer révisé maximum : ${eur(r.computedRent)} (IRL T${r.newIndex!.quarter} ${r.newIndex!.year} : ${r.newIndex!.value} ; référence T${r.reference!.quarter} ${r.reference!.year} : ${r.reference!.value}), soit ${diff >= 0 ? '+' : ''}${eur(diff)} par mois.`)
    if (share < 1) lines.push(`Votre quote-part (${pct(share)}) : ${eur(round2(r.currentRent * share))} → ${eur(round2(r.computedRent * share))}, soit ${diff >= 0 ? '+' : ''}${eur(round2(diff * share))} par mois.`)
  } else {
    lines.push(r.missing === 'REFERENCE'
      ? 'L’IRL de référence du bail n’est pas renseigné : complétez-le dans la fiche du bail.'
      : `L’indice IRL du T${r.expectedIndex!.quarter} ${r.expectedIndex!.year} n’est pas encore saisi : reprenez-le sur insee.fr dès sa publication, puis saisissez-le dans Paramètres.`)
    if (share < 1) lines.push(`Votre quote-part : ${pct(share)}.`)
  }
  if (coOwners.length) lines.push(`Copropriétaires prévenus : ${coOwners.join(', ')}.`)
  lines.push('L’avis de révision se prépare depuis la fiche du bail.')
  return { title: `Révision du loyer à préparer : ${tenant}`, body: lines.join('\n'), link: appLink(`/leases/${lease.id}`) }
}

export const notificationsService = {
  list(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, kind: true, leaseId: true, dueDate: true, title: true, body: true, link: true, readAt: true, createdAt: true },
    })
  },

  async markRead(id: string, userId: string) {
    const { count } = await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } })
    if (!count && !(await prisma.notification.findFirst({ where: { id, userId }, select: { id: true } }))) throw new AppError(404, 'Notification introuvable')
  },

  async markAllRead(userId: string) {
    await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } })
  },

  /** Message d'essai sur tous les canaux configurés, avec le résultat de chacun. */
  async sendTest(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const m = { title: 'Notification d’essai', body: 'Si vous lisez ce message, les notifications de la gestion locative fonctionnent.', link: appLink('/settings') }
    await prisma.notification.create({ data: { userId, kind: 'TEST', title: m.title, body: m.body, link: m.link } })
    return dispatch(user, m)
  },

  /**
   * Prochains rappels de l'utilisateur : pour chaque bail actif de ses biens, la date anniversaire, la date à partir
   * de laquelle le rappel part (anniversaire − délai choisi) et s'il est déjà parti. Sert à vérifier le réglage.
   */
  async upcoming(userId: string, now = new Date()) {
    const today = toUtcDay(now)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { notifyDaysBefore: true } })
    const leases = await prisma.lease.findMany({
      where: { active: true, property: { ownerships: { some: { userId } } } },
      include: { tenant: true, property: { include: { ownerships: ownershipsWithUsers } }, rentRevisions: { orderBy: { effectiveDate: 'asc' } } },
    })
    const sent = await prisma.notification.findMany({ where: { userId, kind: REVISION_KIND }, select: { leaseId: true, dueDate: true, createdAt: true } })
    const rows = []
    for (const lease of leases) {
      const { nextRevisionDate: anniversary } = await computeRevision(lease, undefined)
      if (lease.endDate && toUtcDay(lease.endDate) < anniversary) continue
      const owner = ownersAt(lease.property.ownerships, anniversary).find((o) => o.userId === userId)
      const remindOn = new Date(anniversary.getTime() - user.notifyDaysBefore * 86_400_000)
      const done = sent.find((n) => n.leaseId === lease.id && n.dueDate?.getTime() === anniversary.getTime())
      rows.push({
        leaseId: lease.id, tenantName: `${lease.tenant.firstName} ${lease.tenant.lastName}`, propertyName: lease.property.name,
        anniversary, remindOn, daysLeft: daysBetween(today, anniversary) - 1,
        // Pas propriétaire à la date anniversaire (cession) : pas de rappel pour lui
        status: !owner ? 'not_owner' as const : done ? 'sent' as const : anniversary < today ? 'past' as const : 'planned' as const,
        sentAt: done?.createdAt ?? null,
      })
    }
    return rows.sort((a, b) => a.anniversary.getTime() - b.anniversary.getTime())
  },

  /**
   * Rappels de révision : pour chaque bail actif dont l'anniversaire (ou celui de la dernière révision) tombe dans
   * le délai choisi par chaque propriétaire, une notification par propriétaire à cette date (quotes-parts datées),
   * dans l'application et sur ses canaux. Idempotent : une seule notification par bail, propriétaire et anniversaire.
   */
  async runRevisionReminders(now = new Date()) {
    const today = toUtcDay(now)
    const leases = await prisma.lease.findMany({
      where: { active: true },
      include: { tenant: true, property: { include: { ownerships: ownershipsWithUsers } }, rentRevisions: { orderBy: { effectiveDate: 'asc' } } },
    })
    let created = 0
    for (const lease of leases) {
      const r = await computeRevision(lease, undefined)
      const anniversary = r.nextRevisionDate
      if (anniversary < today || (lease.endDate && toUtcDay(lease.endDate) < anniversary)) continue
      const daysLeft = daysBetween(today, anniversary) - 1
      const owners = ownersAt(lease.property.ownerships, anniversary)
      for (const o of owners) {
        if (daysLeft > o.user.notifyDaysBefore) continue
        const coOwners = owners.filter((x) => x.userId !== o.userId).map((x) => `${x.user.firstName} ${x.user.lastName} (${pct(x.share)})`)
        const m = reminderMessage(lease, await computeRevision(lease, anniversary), o.share, coOwners, daysLeft)
        let id: string
        try {
          id = (await prisma.notification.create({
            data: { userId: o.userId, kind: REVISION_KIND, leaseId: lease.id, dueDate: anniversary, title: m.title, body: m.body, link: m.link },
          })).id
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue // déjà notifié
          throw e
        }
        created++
        const sent = await dispatch(o.user, m)
        await prisma.notification.update({
          where: { id },
          data: { emailSentAt: sent.email === 'sent' ? new Date() : null, phoneSentAt: sent.ntfy === 'sent' || sent.sms === 'sent' ? new Date() : null },
        })
      }
    }
    return { created }
  },
}

/** Lance les rappels au démarrage puis toutes les 6 heures (pas dans les tests). */
export function startNotificationScheduler() {
  const run = () => notificationsService.runRevisionReminders().then(
    ({ created }) => { if (created) console.info(`${created} notification(s) de révision créée(s)`) },
    (e) => console.error('Rappels de révision en échec', e),
  )
  setTimeout(run, 10_000)
  return setInterval(run, 6 * 3600_000)
}
