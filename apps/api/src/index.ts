import express from 'express'
import { createLogger, transports, format } from 'winston'
import router from './routes'
import { errorHandler } from './middlewares/errorHandler'

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
})

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api', router)

// Middleware d'erreur — doit être en dernier
app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`API démarrée sur le port ${PORT}`)
})
