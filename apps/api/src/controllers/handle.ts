import { Request, Response, NextFunction } from 'express'

/** Enveloppe un contrôleur asynchrone : toute erreur part vers le gestionnaire d'erreurs. */
export const handle = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next) }

/** Envoie un PDF généré en mémoire (affiché dans le navigateur, ou téléchargé avec ?download). */
export function sendPdf(req: Request, res: Response, pdf: Buffer, fileName: string) {
  const inline = req.query.download === undefined
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${fileName}"`)
  res.send(pdf)
}
