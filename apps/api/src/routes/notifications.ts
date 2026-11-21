import { Router } from 'express'
import { handle } from '../controllers/handle'
import { currentUser } from '../middlewares/auth'
import { notificationsService } from '../services/notifications'

// Notifications de l'utilisateur connecté
const router = Router()

router.get('/', handle(async (req, res) => { res.json(await notificationsService.list(currentUser(req).id)) }))
router.post('/read-all', handle(async (req, res) => { await notificationsService.markAllRead(currentUser(req).id); res.status(204).end() }))
router.get('/upcoming', handle(async (req, res) => { res.json(await notificationsService.upcoming(currentUser(req).id)) }))
// Lance tout de suite la recherche des rappels (sinon : au démarrage puis toutes les 6 h), puis renvoie les prochains rappels
router.post('/check', handle(async (req, res) => {
  const { created } = await notificationsService.runRevisionReminders()
  res.json({ created, upcoming: await notificationsService.upcoming(currentUser(req).id) })
}))
router.post('/test', handle(async (req, res) => { res.json(await notificationsService.sendTest(currentUser(req).id)) }))
router.post('/:id/read', handle(async (req, res) => { await notificationsService.markRead(req.params.id, currentUser(req).id); res.status(204).end() }))

export default router
