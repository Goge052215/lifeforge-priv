import z from 'zod'

import forge from '../forge'
import { listGoogleCalendarEvents } from '../utils/googleOAuth'

const googleCalendarEventSchema = z.object({
  id: z.string(),
  summary: z.string(),
  description: z.string(),
  status: z.string(),
  htmlLink: z.string(),
  start: z.string(),
  end: z.string(),
  startDateKey: z.string(),
  endDateKey: z.string(),
  isAllDay: z.boolean()
})

export const listPrimaryEvents = forge
  .query({
    description: 'List events from the linked Google primary calendar',
    input: {
      query: z.object({
        timeMin: z.string().optional(),
        timeMax: z.string().optional(),
        maxResults: z.coerce.number().min(1).max(100).optional()
      })
    },
    output: {
      OK: z.object({
        connected: z.boolean(),
        calendarEnabled: z.boolean(),
        events: z.array(googleCalendarEventSchema)
      }),
      BAD_REQUEST: z.string(),
      UNAUTHORIZED: true
    }
  })
  .callback(async ({ pb, query: { timeMin, timeMax, maxResults }, response }) => {
    const userRecord = pb.instance.authStore.record

    if (!userRecord?.id) {
      return response.unauthorized()
    }

    try {
      const result = await listGoogleCalendarEvents({
        googleConnection: (userRecord.googleConnection as never) ?? null,
        encryptedRefreshToken:
          typeof userRecord.googleRefreshToken === 'string'
            ? userRecord.googleRefreshToken
            : null,
        timeMin,
        timeMax,
        maxResults
      })

      return response.ok(result)
    } catch {
      return response.badRequest('Unable to retrieve Google Calendar events.')
    }
  })
