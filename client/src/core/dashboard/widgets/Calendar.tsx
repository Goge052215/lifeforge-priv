import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useMemo } from 'react'

import { useAuth } from '@lifeforge/shared'
import type { WidgetConfig } from '@lifeforge/shared'
import { Card, Flex, Stack, Text } from '@lifeforge/ui'

import forgeAPI from '@/forgeAPI'

type CalendarEvent = {
  id: string
  summary: string
  description: string
  status: string
  htmlLink: string
  start: string
  end: string
  startDateKey: string
  endDateKey: string
  isAllDay: boolean
}

type CalendarQueryResult = {
  connected: boolean
  calendarEnabled: boolean
  events: CalendarEvent[]
}

function getMonthWindow(now: dayjs.Dayjs) {
  const startOfMonth = now.startOf('month')
  const firstVisibleDay = startOfMonth.subtract(startOfMonth.day(), 'day')
  const lastVisibleDay = firstVisibleDay.add(41, 'day').endOf('day')

  return {
    timeMin: firstVisibleDay.startOf('day').toISOString(),
    timeMax: lastVisibleDay.toISOString()
  }
}

function CalendarWidget({
  dimension
}: {
  dimension: { w: number; h: number }
}) {
  const { userData } = useAuth()
  const googleConnected = Boolean(userData?.googleConnected)
  const now = dayjs()
  const monthWindow = useMemo(() => getMonthWindow(now), [now])
  const calendarAPI = forgeAPI.user as typeof forgeAPI.user & {
    calendar: {
      listPrimaryEvents: {
        input: (query: {
          timeMin?: string
          timeMax?: string
          maxResults?: number
        }) => {
          queryOptions: (options?: { enabled?: boolean }) => unknown
        }
      }
    }
  }

  const calendarQuery = useQuery<CalendarQueryResult>(
    calendarAPI.calendar.listPrimaryEvents
      .input({
        ...monthWindow,
        maxResults: 100
      })
      .queryOptions({
        enabled: googleConnected
      }) as never
  )
  const calendarEnabled = googleConnected && Boolean(calendarQuery.data?.calendarEnabled)
  const eventCount = googleConnected && calendarEnabled ? (calendarQuery.data?.events ?? []).length : 0

  const visibleEvents = useMemo(() => {
    const maxVisibleEvents = dimension.h >= 4 ? 4 : dimension.h >= 3 ? 3 : 2

    if (!googleConnected || !calendarEnabled) {
      return []
    }

    return (calendarQuery.data?.events ?? []).slice(0, maxVisibleEvents)
  }, [calendarEnabled, calendarQuery.data?.events, dimension.h, googleConnected])

  return (
    <Card gap="md" height="100%">
      <Flex align="center" justify="between">
        <Stack gap="xs">
          <Text as="h3" size="lg" weight="semibold">
            Calendar
          </Text>
          <Text color="muted" size="sm">
            {now.format('MMMM YYYY')}
          </Text>
        </Stack>
        <Text color="muted" size="sm">
          {eventCount} events
        </Text>
      </Flex>

      {!googleConnected ? (
        <Text color="muted">Link Google services to use Calendar.</Text>
      ) : calendarQuery.isLoading ? (
        <Text color="muted">Loading Google Calendar...</Text>
      ) : calendarQuery.error instanceof Error ? (
        <Text color="dangerous">Unable to load Google Calendar right now.</Text>
      ) : !calendarEnabled ? (
        <Text color="muted">
          Google is linked, but Calendar scope is not available.
        </Text>
      ) : visibleEvents.length > 0 ? (
        <Stack gap="sm">
          {visibleEvents.map(event => (
            <Flex
              key={event.id}
              align="center"
              bg={{ base: 'bg-200', dark: 'bg-800' }}
              justify="between"
              p="sm"
              r="lg"
            >
              <Stack gap="xs" minWidth="0">
                <Text truncate weight="medium">
                  {event.summary}
                </Text>
                <Text color="muted" size="sm">
                  {event.isAllDay
                    ? event.startDateKey
                    : dayjs(event.start).format('MMM D, h:mm A')}
                </Text>
              </Stack>
              <Text color="muted" size="sm">
                {dayjs(event.start).format('ddd')}
              </Text>
            </Flex>
          ))}
        </Stack>
      ) : (
        <Text color="muted">No calendar events in this month window.</Text>
      )}
    </Card>
  )
}

export default CalendarWidget

export const config: WidgetConfig = {
  id: 'calendar',
  icon: 'tabler:calendar-month',
  minW: 2,
  minH: 2,
  maxW: 4
}
