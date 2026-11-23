import { createLogger, transports, format } from 'winston'
import { app } from './app'
import { checkAuthConfig } from './lib/auth'
import { startNotificationScheduler } from './services/notifications'
import { startIrlScheduler } from './services/irl'

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()],
})

checkAuthConfig()

const PORT = process.env.PORT ?? 3001

app.listen(PORT, () => {
  logger.info(`API démarrée sur le port ${PORT}`)
})

// Rappels de révision (anniversaire des baux) : NOTIFICATIONS=off pour les désactiver
if (process.env.NOTIFICATIONS !== 'off') startNotificationScheduler()

// Import quotidien des indices IRL publiés par l'INSEE : IRL_SYNC=off pour le désactiver
if (process.env.IRL_SYNC !== 'off') startIrlScheduler()
