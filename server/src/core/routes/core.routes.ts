import { ROOT_DIR } from '@constants'
import { getPublicKey } from '@functions/encryption'
import corsAnywhere from '@lib/corsAnywhere'
import dayjs from 'dayjs'
import type { Response } from 'express'
import path from 'path'
import request from 'request'
import z from 'zod'

// @ts-ignore VS Code fails to pick up local workspace declarations here.
import { forgeRouter, writeContractFileToClient } from '@lifeforge/server-utils'

import forge from './forge'

const welcome = forge
  .query({
    description: 'Welcome to LifeForge API',
    noAuth: true,
    encrypted: false,
    output: {
      OK: z.literal('Get ready to forge your life!')
    }
  })
  .callback(
    async ({
      response
    }: {
      response: {
        ok: (
          payload: 'Get ready to forge your life!'
        ) => { $status: 200; payload: 'Get ready to forge your life!' }
      }
    }) =>
    response.ok('Get ready to forge your life!')
  )

const ping = forge
  .mutation({
    description: 'Ping the server',
    noAuth: true,
    encrypted: false,
    input: {
      body: z.object({
        timestamp: z.number().min(0)
      })
    },
    output: {
      OK: z.string()
    }
  })
  .callback(
    async ({
      body: { timestamp },
      response
    }: {
      body: { timestamp: number }
      response: {
        ok: (payload: string) => { $status: 200; payload: string }
      }
    }) =>
    response.ok(`Pong at ${dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')}`)
  )

const status = forge
  .query({
    description: 'Get server status',
    noAuth: true,
    encrypted: false,
    input: {},
    output: {
      OK: z.object({
        environment: z.string()
      })
    }
  })
  .callback(
    async ({
      response
    }: {
      response: {
        ok: (payload: { environment: string }) => {
          $status: 200
          payload: { environment: string }
        }
      }
    }) =>
    response.ok({
      environment: process.env.NODE_ENV || 'development'
    })
  )

const getMedia = forge
  .query({
    description: 'Retrieve media file from PocketBase',
    noAuth: true,
    encrypted: false,

    input: {
      query: z.object({
        collectionId: z.string(),
        recordId: z.string(),
        fieldId: z.string(),
        thumb: z.string().optional(),
        token: z.string().optional()
      })
    },
    output: 'custom'
  })
  .callback(
    async ({
      query: { collectionId, recordId, fieldId, thumb, token },
      res
    }: {
      query: {
        collectionId: string
        recordId: string
        fieldId: string
        thumb?: string
        token?: string
      }
      res: Response
    }) => {
      const searchParams = new URLSearchParams()

      if (thumb) {
        searchParams.append('thumb', thumb)
      }

      if (token) {
        searchParams.append('token', token)
      }

      request(
        `${process.env.PB_HOST}/api/files/${collectionId}/${recordId}/${fieldId}?${searchParams.toString()}`
      ).pipe(res)
    }
  )

const encryptionPublicKey = forge
  .query({
    description: 'Get server public key for end-to-end encryption',
    noAuth: true,
    encrypted: false,
    input: {},
    output: {
      OK: z.string()
    }
  })
  .callback(
    async ({
      response
    }: {
      response: {
        ok: (payload: string) => { $status: 200; payload: string }
      }
    }) => response.ok(getPublicKey())
  )

const coreRoutes = forgeRouter({
  '': welcome,
  locales: (await import('@lib/locales')).default,
  user: (await import('@lib/user')).default,
  apiKeys: (await import('@lib/apiKeys')).default,
  pixabay: (await import('@lib/pixabay')).default,
  locations: (await import('@lib/locations')).default,
  backups: (await import('@lib/backups')).default,
  database: (await import('@lib/database')).default,
  modules: (await import('@lib/modules')).default,
  ai: (await import('@lib/ai')).default,
  ping,
  status,
  media: getMedia,
  corsAnywhere,
  encryptionPublicKey
})

if (!process.env.VERCEL) {
  writeContractFileToClient(
    coreRoutes,
    ROOT_DIR
  )
  writeContractFileToClient(
    coreRoutes,
    path.resolve(ROOT_DIR, 'packages/ui/src'),
    '.'
  )
}

export default coreRoutes
