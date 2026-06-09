import { PORT } from '@constants'
import { initializeServer } from './bootstrap'
import traceRouteStack from '@functions/initialization/traceRouteStack'
import { LOG_LEVELS, type LogLevel, coreLogger } from '@functions/logging'
import createSocketServer from '@functions/socketio/createSocketServer'
import chalk from 'chalk'
import { program } from 'commander'
import { createServer } from 'http'

import app from './core/app'

// Parse CLI arguments
program
  .name('lifeforge-server')
  .description('LifeForge API Server')
  .option(
    '-l, --log-level <level>',
    `Set log level (${LOG_LEVELS.join(', ')})`,
    'info'
  )
  .parse()

const opts = program.opts<{ logLevel: string }>()

if (opts.logLevel) {
  const level = opts.logLevel.toLowerCase()

  if (LOG_LEVELS.includes(level as LogLevel)) {
    coreLogger.setLevel(level as LogLevel)
  } else {
    console.error(
      `Invalid log level: ${opts.logLevel}. Valid levels: ${LOG_LEVELS.join(', ')}`
    )
    process.exit(1)
  }
}

function startServer(server: ReturnType<typeof createServer>): void {
  server.listen(PORT, () => {
    const routes = traceRouteStack(app._router.stack)

    coreLogger.info(`Registered routes: ${chalk.green(routes.length)}`)
    coreLogger.info(`REST API server running on port ${chalk.green(PORT)}`)
  })
}

async function main(): Promise<void> {
  await initializeServer()

  const server = createSocketServer(app)

  startServer(server)
}

main()
