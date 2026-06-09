import type { Request, Response } from 'express'

import app from '../src/core/app'
import { initializeServer } from '../src/bootstrap'

let bootstrapped = false

export default async function handler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    await initializeServer()

    if (!bootstrapped) {
      app.request.io = undefined as never
      bootstrapped = true
    }

    app(req, res)
  } catch (error) {
    console.error('Failed to initialize Vercel API handler', error)

    res.status(500).json({
      state: 'error',
      message: 'Failed to initialize server'
    })
  }
}
