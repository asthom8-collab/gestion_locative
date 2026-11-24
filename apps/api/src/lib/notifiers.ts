import nodemailer from 'nodemailer'

/**
 * Canaux d'envoi des notifications. Regroupés dans un objet pour que les tests puissent les remplacer.
 * Chaque fonction lève une erreur en cas d'échec (message lisible).
 */
export type Message = { title: string; body: string; link?: string | null }

export const smtpConfigured = () => !!process.env.SMTP_HOST

let transport: nodemailer.Transporter | null = null
function mailer() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465)
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  }
  return transport
}

async function checkResponse(res: Response, what: string, reasons: Record<number, string> = {}) {
  if (!res.ok) throw new Error(`${what} : ${reasons[res.status] ?? `erreur ${res.status}`}`)
}

export const notifiers = {
  async email(to: string, m: Message) {
    const text = m.link ? `${m.body}\n\n${m.link}` : m.body
    await mailer().sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject: m.title, text })
  },

  /** ntfy : sujet sur ntfy.sh, ou adresse complète d'un serveur ntfy (https://serveur/sujet). */
  async ntfy(topic: string, m: Message) {
    const url = topic.startsWith('https://') ? new URL(topic) : new URL(`https://ntfy.sh/${topic}`)
    const res = await fetch(url.origin, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: url.pathname.replace(/^\/+/, ''), title: m.title, message: m.body, ...(m.link?.startsWith('http') ? { click: m.link } : {}) }),
      signal: AbortSignal.timeout(10_000),
    })
    await checkResponse(res, 'ntfy')
  },

  /** SMS Free Mobile (option « Notifications par SMS » de l'espace abonné, vers son propre numéro). */
  async freeMobile(user: string, key: string, m: Message) {
    const msg = [m.title, m.body, m.link?.startsWith('http') ? m.link : ''].filter(Boolean).join('\n\n')
    const res = await fetch(`https://smsapi.free-mobile.fr/sendmsg?${new URLSearchParams({ user, pass: key, msg })}`, { signal: AbortSignal.timeout(10_000) })
    await checkResponse(res, 'SMS Free Mobile', {
      400: 'paramètre manquant', 402: 'trop de SMS envoyés, réessayez plus tard',
      403: 'service non activé dans l’espace abonné, ou identifiant / clé incorrects', 500: 'erreur du serveur Free',
    })
  },
}
