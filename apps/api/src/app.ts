import express from 'express'
import router from './routes'
import { errorHandler } from './middlewares/errorHandler'

// Application Express sans écoute réseau : utilisée par index.ts et par les tests
export const app = express()

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api', router)

// Middleware d'erreur — doit être en dernier
app.use(errorHandler)
