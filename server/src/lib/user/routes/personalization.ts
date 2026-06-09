import NodeCache from 'node-cache'
import z from 'zod'

import forge from '../forge'
import { serializeDashboardLayout } from '../utils/dashboardLayoutPersistence'

const fontCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 })

export const listGoogleFonts = forge
  .query({
    description: 'Retrieve available Google Fonts',
    noAuth: true,
    input: {},
    output: {
      OK: z.object({
        enabled: z.boolean(),
        items: z.array(
          z.object({
            family: z.string(),
            variants: z.array(z.string()),
            subsets: z.array(z.string()),
            version: z.string(),
            lastModified: z.string(),
            files: z.object({
              regular: z.string().optional(),
              italic: z.string().optional(),
              '500': z.string().optional(),
              '600': z.string().optional(),
              '700': z.string().optional(),
              '800': z.string().optional(),
              '100': z.string().optional(),
              '200': z.string().optional(),
              '300': z.string().optional(),
              '900': z.string().optional(),
              '100italic': z.string().optional(),
              '200italic': z.string().optional(),
              '300italic': z.string().optional(),
              '500italic': z.string().optional(),
              '600italic': z.string().optional(),
              '700italic': z.string().optional(),
              '800italic': z.string().optional(),
              '900italic': z.string().optional()
            }),
            category: z.enum([
              'display',
              'handwriting',
              'monospace',
              'sans-serif',
              'serif'
            ]),
            kind: z.literal('webfonts#webfont'),
            menu: z.string(),
            colorCapabilities: z
              .array(z.enum(['COLRv0', 'COLRv1', 'SVG']))
              .optional()
          })
        )
      })
    }
  })
  .callback(
    async ({
      pb,
      core: {
        api: { getAPIKey }
      },
      response
    }) => {
      const cached = fontCache.get('listGoogleFonts')

      if (cached) {
        return response.ok(cached as any)
      }

      const key = await getAPIKey('gcloud', pb)

      if (!key) {
        return response.ok({
          enabled: false,
          items: []
        } as any)
      }

      const target = `https://www.googleapis.com/webfonts/v1/webfonts?key=${key}`

      const r = await fetch(target)

      const data = await r.json()

      const result = {
        enabled: true,
        items: data.items
      } as any

      fontCache.set('listGoogleFonts', result)

      return response.ok(result)
    }
  )

export const getGoogleFont = forge
  .query({
    description: 'Get details of a specific Google Font',
    noAuth: true,
    input: {
      query: z.object({
        family: z.string()
      })
    },
    output: {
      OK: z.object({
        enabled: z.boolean(),
        items: z.any().optional()
      })
    }
  })
  .callback(
    async ({
      pb,
      query: { family },
      core: {
        api: { getAPIKey }
      },
      response
    }) => {
      const cacheKey = `getGoogleFont:${family}`

      const cached = fontCache.get<{ enabled: boolean; items?: unknown }>(
        cacheKey
      )

      if (cached) {
        return response.ok(cached)
      }

      const key = await getAPIKey('gcloud', pb).catch(() => null)

      if (!key) {
        return response.ok({
          enabled: false
        })
      }

      const target = `https://www.googleapis.com/webfonts/v1/webfonts?family=${encodeURIComponent(family)}&key=${key}`

      const r = await fetch(target)

      const data = await r.json()

      const result = {
        enabled: true,
        items: data.items
      }

      fontCache.set(cacheKey, result)

      return response.ok(result)
    }
  )

export const listGoogleFontsPin = forge
  .query({
    description: 'Retrieve pinned Google Fonts',
    input: {},
    output: {
      OK: z.array(z.string()),
      UNAUTHORIZED: true
    }
  })
  .callback(async ({ pb, response }) => {
    if (!pb.instance.authStore.record) {
      return response.unauthorized()
    }

    const record = await pb.getOne
      .collection('users')
      .id(pb.instance.authStore.record.id)
      .execute()

    return response.ok((record.pinnedFontFamilies || []) as string[])
  })

export const toggleGoogleFontsPin = forge
  .mutation({
    description: 'Pin or unpin a Google Font',
    input: {
      body: z.object({
        family: z.string()
      })
    },
    output: {
      NO_CONTENT: true,
      UNAUTHORIZED: true
    }
  })
  .callback(async ({ pb, body: { family }, response }) => {
    if (!pb.instance.authStore.record) {
      return response.unauthorized()
    }

    const record = await pb.getOne
      .collection('users')
      .id(pb.instance.authStore.record.id)
      .execute()

    const pinnedFontFamilies: string[] = record.pinnedFontFamilies || []

    const updatedPinnedFontFamilies = pinnedFontFamilies.includes(family)
      ? pinnedFontFamilies.filter(f => f !== family)
      : [...pinnedFontFamilies, family]

    await pb.update
      .collection('users')
      .id(pb.instance.authStore.record.id)
      .data({
        pinnedFontFamilies: updatedPinnedFontFamilies
      })
      .execute()

    return response.noContent()
  })

export const updateBgImage = forge
  .mutation({
    description: 'Upload new background image',
    input: {},
    media: {
      file: {
        optional: false
      }
    },
    output: {
      OK: z.object({
        collectionId: z.string(),
        recordId: z.string(),
        fieldId: z.string()
      })
    }
  })
  .callback(
    async ({
      pb,
      media: { file },
      core: {
        media: { retrieveMedia }
      },
      response
    }) => {
      const newRecord = await pb.update
        .collection('users')
        .id(pb.instance.authStore.record!.id)
        .data({
          ...(await retrieveMedia('bgImage', file)),
          backdropFilters: {
            brightness: 100,
            blur: 'none',
            contrast: 100,
            saturation: 100,
            overlayOpacity: 50
          }
        })
        .execute()

      return response.ok({
        collectionId: newRecord.collectionId,
        recordId: newRecord.id,
        fieldId: newRecord.bgImage
      })
    }
  )

export const deleteBgImage = forge
  .mutation({
    description: 'Remove background image',
    input: {},
    output: {
      NO_CONTENT: true
    }
  })
  .callback(async ({ pb, response }) => {
    await pb.update
      .collection('users')
      .id(pb.instance.authStore.record!.id)
      .data({
        bgImage: null
      })
      .execute()

    return response.noContent()
  })

export const updatePersonalization = forge
  .mutation({
    description: 'Update user personalization preferences',
    input: {
      body: z.object({
        data: z.object({
          fontFamily: z.string().optional(),
          theme: z.string().optional(),
          color: z.string().optional(),
          bgTemp: z.string().optional(),
          language: z.string().optional(),
          fontScale: z.number().optional(),
          borderRadiusMultiplier: z.number().optional(),
          bordered: z.boolean().optional(),
          dashboardLayout: z.record(z.string(), z.any()).optional(),
          backdropFilters: z.record(z.string(), z.any()).optional()
        })
      })
    },
    output: {
      NO_CONTENT: true,
      BAD_REQUEST: z.string(),
      UNAUTHORIZED: true
    }
  })
  .callback(async ({ pb, body: { data }, response }) => {
    // #region debug-point B:update-personalization-entry
    fetch(process.env.DEBUG_SERVER_URL || 'http://127.0.0.1:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: process.env.DEBUG_SESSION_ID || 'railway-auth-500', runId: 'pre-fix', hypothesisId: 'B', location: 'personalization.ts:updatePersonalization:entry', msg: '[DEBUG] update personalization entry', data: { hasAuthRecord: Boolean(pb.instance.authStore.record?.id), dataKeys: Object.keys(data || {}) }, ts: Date.now() }) }).catch(() => {})
    // #endregion
    const toBeUpdated: { [key: string]: unknown } = {}

    for (const item of [
      'fontFamily',
      'theme',
      'color',
      'bgTemp',
      'language',
      'fontScale',
      'borderRadiusMultiplier',
      'bordered',
      'dashboardLayout',
      'backdropFilters'
    ]) {
      if (data[item as keyof typeof data] !== undefined) {
        toBeUpdated[item] =
          item === 'dashboardLayout'
            ? serializeDashboardLayout(data[item as keyof typeof data])
            : data[item as keyof typeof data]
      }
    }

    if (!Object.keys(toBeUpdated).length) {
      // #region debug-point B:update-personalization-no-data
      fetch(process.env.DEBUG_SERVER_URL || 'http://127.0.0.1:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: process.env.DEBUG_SESSION_ID || 'railway-auth-500', runId: 'pre-fix', hypothesisId: 'B', location: 'personalization.ts:updatePersonalization:no-data', msg: '[DEBUG] update personalization rejected empty update payload', data: { dataKeys: Object.keys(data || {}) }, ts: Date.now() }) }).catch(() => {})
      // #endregion
      return response.badRequest('No data to update')
    }

    if (!pb.instance.authStore.record?.id) {
      return response.unauthorized()
    }

    try {
      if (toBeUpdated.dashboardLayout !== undefined) {
        // #region debug-point B:dashboard-layout-persist-attempt
        fetch('http://127.0.0.1:7778/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'dashboard-layout-persistence', runId: 'pre-fix', hypothesisId: 'B', location: 'personalization.ts:350', msg: '[DEBUG] persisting dashboard layout to backend', data: { userId: pb.instance.authStore.record?.id, breakpoints: Object.keys((toBeUpdated.dashboardLayout as Record<string, unknown>) || {}), counts: Object.fromEntries(Object.entries((toBeUpdated.dashboardLayout as Record<string, unknown[]>) || {}).map(([key, value]) => [key, Array.isArray(value) ? value.length : -1])) }, ts: Date.now() }) }).catch(() => {})
        // #endregion
      }

      await pb.update
        .collection('users')
        .id(pb.instance.authStore.record.id)
        .data(toBeUpdated)
        .execute()
      // #region debug-point B:update-personalization-success
      fetch(process.env.DEBUG_SERVER_URL || 'http://127.0.0.1:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: process.env.DEBUG_SESSION_ID || 'railway-auth-500', runId: 'pre-fix', hypothesisId: 'B', location: 'personalization.ts:updatePersonalization:success', msg: '[DEBUG] update personalization saved successfully', data: { userId: pb.instance.authStore.record?.id, updatedKeys: Object.keys(toBeUpdated) }, ts: Date.now() }) }).catch(() => {})
      // #endregion
    } catch (error: any) {
      // #region debug-point B:update-personalization-failure
      fetch(process.env.DEBUG_SERVER_URL || 'http://127.0.0.1:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: process.env.DEBUG_SESSION_ID || 'railway-auth-500', runId: 'pre-fix', hypothesisId: 'B', location: 'personalization.ts:updatePersonalization:failure', msg: '[DEBUG] update personalization failed during persistence', data: { userId: pb.instance.authStore.record?.id, updatedKeys: Object.keys(toBeUpdated), errorName: error?.name, errorMessage: error?.message, errorStatus: error?.status, response: error?.response }, ts: Date.now() }) }).catch(() => {})
      // #endregion
      throw error
    }

    return response.noContent()
  })
