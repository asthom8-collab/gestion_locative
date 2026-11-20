import { createLogger, transports, format } from 'winston'
import { app } from './app'

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
})

const PORT = process.env.PORT ?? 3001

app.listen(PORT, () => {
  logger.info(`API démarrée sur le port ${PORT}`)
})
