import { MEDIA_DIR } from '@constants'
import chalk from 'chalk'
import { Response } from 'express'
import fs from 'fs'

import { createLogger } from '@lifeforge/log'
import { BaseResponse } from '@lifeforge/server-utils'

function clearMediumDirectory(): void {
  if (!fs.existsSync(MEDIA_DIR)) {
    return
  }

  fs.readdirSync(MEDIA_DIR).forEach(file => {
    const filePath = `${MEDIA_DIR}/${file}`

    if (fs.statSync(filePath).isFile()) {
      fs.unlinkSync(filePath)
    } else {
      fs.rmSync(filePath, { recursive: true, force: true })
    }
  })
}

export function clientError({
  res,
  message = 'Bad Request',
  code = 400,
  moduleName = 'unknown-module'
}: {
  res: Response
  message?: any
  code?: number
  moduleName?: string
}) {
  const logger = createLogger({ name: moduleName || 'unknown-module' })

  clearMediumDirectory()

  try {
    logger.error(
      chalk.red(typeof message === 'string' ? message : JSON.stringify(message))
    )

    res.status(code).json({
      state: 'error',
      message
    })
  } catch {
    console.error('Failed to send response')
  }
}

export function serverError(res: Response, err?: string, moduleName?: string) {
  const logger = createLogger({ name: moduleName || 'unknown-module' })

  clearMediumDirectory()

  try {
    logger.error(chalk.red(err))

    res.status(500).json({
      state: 'error',
      message: err || 'Internal server error'
    })
  } catch {
    console.error('Failed to send response')
  }
}

export function success<T>(
  res: Response<BaseResponse<T>>,
  data: T,
  statusCode: number = 200
) {
  try {
    res.status(statusCode).json({
      state: 'success',
      data: data
    })
  } catch {
    console.error('Failed to send response')
  }
}
