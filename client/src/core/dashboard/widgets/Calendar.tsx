import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { toast } from 'react-toastify'

import { useAuth, usePromiseLoading } from '@lifeforge/shared'
import type { WidgetConfig } from '@lifeforge/shared'
import { Box, Button, Card, Flex, Stack, Text } from '@lifeforge/ui'

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

function getMonthCells(now: dayjs.Dayjs) {
  const startOfMonth = now.startOf('month')
  const firstVisibleDay = startOfMonth.subtract(startOfMonth.day(), 'day')

  return Array.from({ length: 42 }, (_, index) => {
    const date = firstVisibleDay.add(index, 'day')

    return {
      key: date.format('YYYY-MM-DD'),
      date,
      isCurrentMonth: date.month() === now.month(),
      isToday: date.isSame(now, 'day')
    }
  })
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
  const monthKey = now.format('YYYY-MM')
  const compactWeekday = dimension.w <= 2
  const showEventList = dimension.h >= 4
  const weekdays = compactWeekday
    ? ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthWindow = useMemo(() => getMonthWindow(now), [monthKey])
  const monthCells = useMemo(() => getMonthCells(now), [monthKey])
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
    oauth: {
      getGoogleLinkEndpoint: {
        query: (input: {
          redirectTo: string
          services: string
        }) => Promise<{ authURL: string }>
      }
    }
  }

  async function handleLinkGoogleServices() {
    try {
      const data = await calendarAPI.oauth.getGoogleLinkEndpoint.query({
        redirectTo: '/dashboard',
        services: 'calendar,gmail,drive'
      })

      window.location.assign(data.authURL)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to link Google services.'

      toast.error(message)
    }
  }

  const [linkLoading, startLinkFlow] = usePromiseLoading(handleLinkGoogleServices)
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
  const syncedEvents = googleConnected && calendarEnabled ? (calendarQuery.data?.events ?? []) : []
  const eventCount = syncedEvents.length
  const eventCountByDay = useMemo(
    () =>
      Object.fromEntries(
        syncedEvents.reduce((accumulator, event) => {
          accumulator.set(
            event.startDateKey,
            (accumulator.get(event.startDateKey) ?? 0) + 1
          )
          return accumulator
        }, new Map<string, number>())
      ),
    [syncedEvents]
  )

  const visibleEvents = useMemo(() => {
    const maxVisibleEvents = dimension.h >= 4 ? 4 : dimension.h >= 3 ? 3 : 2

    return syncedEvents.slice(0, maxVisibleEvents)
  }, [dimension.h, syncedEvents])

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
        {!googleConnected || !calendarEnabled ? (
          <Button
            icon="tabler:brand-google"
            loading={linkLoading}
            p={dimension.w <= 2 ? 'sm' : 'md'}
            onClick={startLinkFlow}
          >
            {dimension.w <= 2 ? 'Link' : 'Link Google'}
          </Button>
        ) : (
          <Text color="muted" size="sm">
            {eventCount} synced
          </Text>
        )}
      </Flex>

      <div
        style={{
          display: 'grid',
          gap: '0.35rem',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))'
        }}
      >
        {weekdays.map(day => (
          <Text key={day} align="center" color="muted" size="sm" weight="medium">
            {day}
          </Text>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gap: '0.35rem',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))'
        }}
      >
        {monthCells.map(({ key, date, isCurrentMonth, isToday }) => {
          const dayKey = date.format('YYYY-MM-DD')
          const dayEventCount = eventCountByDay[dayKey] ?? 0

          return (
            <Box
              key={key}
              bg={
                isToday
                  ? 'custom-500'
                  : isCurrentMonth
                    ? { base: 'bg-200', dark: 'bg-800' }
                    : { base: 'bg-100', dark: 'bg-900' }
              }
              minHeight={showEventList ? '3.25rem' : '2.7rem'}
              p={dimension.w <= 2 ? 'xs' : 'sm'}
              r="lg"
            >
              <Stack centered gap="xs" height="100%">
                <Text
                  align="center"
                  color={isToday ? 'bg-50' : isCurrentMonth ? undefined : 'muted'}
                  size="sm"
                  weight={isToday ? 'semibold' : 'medium'}
                >
                  {date.date()}
                </Text>
                {dayEventCount > 0 && (
                  <Text
                    align="center"
                    color={isToday ? 'bg-50' : 'primary'}
                    size="sm"
                    weight="medium"
                  >
                    {dayEventCount}
                  </Text>
                )}
              </Stack>
            </Box>
          )
        })}
      </div>

      {!googleConnected ? (
        <Text color="muted">
          Local calendar is available. Link Google to sync your events.
        </Text>
      ) : calendarQuery.isLoading ? (
        <Text color="muted">Loading Google Calendar...</Text>
      ) : calendarQuery.error instanceof Error ? (
        <Text color="dangerous">Unable to load Google Calendar right now.</Text>
      ) : !calendarEnabled ? (
        <Text color="muted">
          Google is linked, but Calendar permission still needs approval.
        </Text>
      ) : showEventList && visibleEvents.length > 0 ? (
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
      ) : googleConnected && calendarEnabled ? (
        <Text color="muted">No calendar events in this month window.</Text>
      ) : null}

      {showEventList && eventCount > visibleEvents.length ? (
        <Text color="muted" size="sm">
          +{eventCount - visibleEvents.length} more synced events this month
        </Text>
      ) : null}
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
