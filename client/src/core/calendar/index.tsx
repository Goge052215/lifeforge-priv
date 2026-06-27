import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useMemo, useRef, useState } from 'react'

import {
  type IDashboardLayout,
  useAuth,
  usePersonalization
} from '@lifeforge/shared'
import {
  Box,
  ContextMenuItem,
  Flex,
  ModuleHeader,
  OptionsColumn,
  Stack,
  Text
} from '@lifeforge/ui'

import EditableLayoutSaveBar from '@/core/common/editableLayout/EditableLayoutSaveBar'
import EditableModuleGrid from '@/core/common/editableLayout/EditableModuleGrid'
import forgeAPI from '@/forgeAPI'
import { useUserPersonalization } from '@/providers/features/UserPersonalizationProvider'

const DEFAULT_CALENDAR_LAYOUT: IDashboardLayout = {
  lg: [
    { i: 'month-view', x: 0, y: 0, w: 5, h: 5, minW: 3, minH: 4 },
    { i: 'today-overview', x: 5, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { i: 'upcoming-days', x: 5, y: 2, w: 3, h: 3, minW: 2, minH: 2 }
  ],
  md: [
    { i: 'month-view', x: 0, y: 0, w: 5, h: 5, minW: 3, minH: 4 },
    { i: 'today-overview', x: 5, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { i: 'upcoming-days', x: 5, y: 2, w: 3, h: 3, minW: 2, minH: 2 }
  ],
  sm: [
    { i: 'month-view', x: 0, y: 0, w: 4, h: 5, minW: 2, minH: 4 },
    { i: 'today-overview', x: 0, y: 5, w: 4, h: 2, minW: 2, minH: 2 },
    { i: 'upcoming-days', x: 0, y: 7, w: 4, h: 3, minW: 2, minH: 2 }
  ],
  xs: [
    { i: 'month-view', x: 0, y: 0, w: 4, h: 5, minW: 2, minH: 4 },
    { i: 'today-overview', x: 0, y: 5, w: 4, h: 2, minW: 2, minH: 2 },
    { i: 'upcoming-days', x: 0, y: 7, w: 4, h: 3, minW: 2, minH: 2 }
  ],
  xxs: [
    { i: 'month-view', x: 0, y: 0, w: 4, h: 5, minW: 2, minH: 4 },
    { i: 'today-overview', x: 0, y: 5, w: 4, h: 2, minW: 2, minH: 2 },
    { i: 'upcoming-days', x: 0, y: 7, w: 4, h: 3, minW: 2, minH: 2 }
  ]
}

function hasLayout(layout: IDashboardLayout) {
  return Object.values(layout).some(items => items.length > 0)
}

function getMonthCells(now = dayjs()) {
  const startOfMonth = now.startOf('month')
  const startOffset = startOfMonth.day()
  const firstVisibleDay = startOfMonth.subtract(startOffset, 'day')

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

type CalendarState = {
  loading: boolean
  errorMessage: string | null
  connected: boolean
  calendarEnabled: boolean
  events: CalendarEvent[]
}

function CalendarStatus({
  state
}: {
  state: CalendarState
}) {
  if (state.loading) {
    return <Text color="muted">Loading Google Calendar...</Text>
  }

  if (state.errorMessage) {
    return <Text color="dangerous">{state.errorMessage}</Text>
  }

  if (!state.connected) {
    return <Text color="muted">Google services are not linked yet.</Text>
  }

  if (!state.calendarEnabled) {
    return (
      <Text color="muted">
        Google is linked, but Calendar scope is not available for this account.
      </Text>
    )
  }

  return null
}

function CalendarMonthView({
  dimension,
  state
}: {
  dimension: { w: number; h: number }
  state: CalendarState
}) {
  const now = dayjs()
  const compactWeekday = dimension.w <= 3
  const weekdays = compactWeekday
    ? ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const cells = useMemo(() => getMonthCells(now), [now])
  const eventCountByDay = useMemo(
    () =>
      Object.fromEntries(
        state.events.reduce(
          (accumulator, event) => {
            accumulator.set(
              event.startDateKey,
              (accumulator.get(event.startDateKey) ?? 0) + 1
            )
            return accumulator
          },
          new Map<string, number>()
        )
      ),
    [state.events]
  )

  return (
    <OptionsColumn
      breakpoint={false}
      description={now.format('MMMM YYYY')}
      height="100%"
      icon="tabler:calendar-month"
      orientation="vertical"
      title="Month View"
    >
      <CalendarStatus state={state} />
      <Stack gap="md" width="100%">
        <div
          style={{
            display: 'grid',
            gap: '0.5rem',
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
            gap: '0.5rem',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))'
          }}
        >
          {cells.map(({ key, date, isCurrentMonth, isToday }) => (
            <Box
              key={key}
              bg={
                isToday
                  ? 'custom-500'
                  : isCurrentMonth
                    ? { base: 'bg-200', dark: 'bg-800' }
                    : { base: 'bg-100', dark: 'bg-900' }
              }
              minHeight={dimension.h >= 5 ? '3.5rem' : '2.8rem'}
              p="sm"
              r="lg"
            >
              <Stack centered gap="xs" height="100%">
                <Text
                  align="center"
                  color={isToday ? 'bg-50' : isCurrentMonth ? undefined : 'muted'}
                  size={compactWeekday ? 'sm' : 'base'}
                  weight={isToday ? 'semibold' : 'medium'}
                >
                  {date.date()}
                </Text>
                {(eventCountByDay[date.format('YYYY-MM-DD')] ?? 0) > 0 && (
                  <Text
                    align="center"
                    color={isToday ? 'bg-50' : 'primary'}
                    size="sm"
                    weight="medium"
                  >
                    {eventCountByDay[date.format('YYYY-MM-DD')]} event
                    {eventCountByDay[date.format('YYYY-MM-DD')] > 1 ? 's' : ''}
                  </Text>
                )}
              </Stack>
            </Box>
          ))}
        </div>
      </Stack>
    </OptionsColumn>
  )
}

function TodayOverview({
  dimension,
  state
}: {
  dimension: { w: number; h: number }
  state: CalendarState
}) {
  const now = dayjs()
  const weekProgress = Math.round(((now.day() + 1) / 7) * 100)
  const monthProgress = Math.round((now.date() / now.daysInMonth()) * 100)
  const nextEvent = useMemo(
    () =>
      state.events.find(
        event => dayjs(event.end).isAfter(now) && event.startDateKey === now.format('YYYY-MM-DD')
      ) ??
      state.events.find(event => dayjs(event.end).isAfter(now)),
    [now, state.events]
  )

  return (
    <OptionsColumn
      breakpoint={false}
      description="Current date snapshot"
      height="100%"
      icon="tabler:sun-high"
      orientation="vertical"
      title="Today"
    >
      <Stack gap="sm" width="100%">
        <Text size={dimension.h >= 3 ? '5xl' : '4xl'} weight="semibold">
          {now.format('DD')}
        </Text>
        <Text as="p" color="muted" size="lg">
          {now.format('dddd, MMMM D')}
        </Text>
        <Text as="p" color="muted">
          Week {weekProgress}% complete
        </Text>
        <Text as="p" color="muted">
          Month {monthProgress}% complete
        </Text>
        <CalendarStatus state={state} />
        {nextEvent && !state.loading && !state.errorMessage && state.calendarEnabled && (
          <Box
            bg={{ base: 'bg-200', dark: 'bg-800' }}
            p="sm"
            r="lg"
            width="100%"
          >
            <Text weight="medium">{nextEvent.summary}</Text>
            <Text as="p" color="muted" size="sm">
              {nextEvent.isAllDay
                ? nextEvent.startDateKey
                : dayjs(nextEvent.start).format('MMM D, h:mm A')}
            </Text>
          </Box>
        )}
      </Stack>
    </OptionsColumn>
  )
}

function UpcomingDays({
  dimension,
  state
}: {
  dimension: { w: number; h: number }
  state: CalendarState
}) {
  const now = dayjs()
  const visibleDays = dimension.h >= 4 ? 7 : 5
  const days = Array.from({ length: visibleDays }, (_, index) => now.add(index, 'day'))
  const eventsByDay = useMemo(
    () =>
      state.events.reduce(
        (accumulator, event) => {
          const existingEvents = accumulator.get(event.startDateKey) ?? []
          accumulator.set(event.startDateKey, [...existingEvents, event])
          return accumulator
        },
        new Map<string, CalendarEvent[]>()
      ),
    [state.events]
  )

  return (
    <OptionsColumn
      breakpoint={false}
      description="Rolling next days"
      height="100%"
      icon="tabler:list-details"
      orientation="vertical"
      title="Upcoming"
    >
      <CalendarStatus state={state} />
      <Stack gap="sm" width="100%">
        {days.map((date, index) => {
          const events = eventsByDay.get(date.format('YYYY-MM-DD')) ?? []

          return (
          <Flex
            key={date.format('YYYY-MM-DD')}
            align="center"
            bg={index === 0 ? { base: 'bg-200', dark: 'bg-800' } : undefined}
            justify="between"
            p="sm"
            r="lg"
          >
            <Stack gap="xs" minWidth="0">
              <Text weight={index === 0 ? 'semibold' : 'medium'}>
                {index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : date.format('dddd')}
              </Text>
              <Text color="muted" size="sm">
                {events.length > 0
                  ? events[0].summary
                  : state.calendarEnabled
                    ? 'No events'
                    : 'Calendar unavailable'}
              </Text>
            </Stack>
            <Text color="muted">
              {events.length > 0 ? `${events.length}` : date.format('MMM D')}
            </Text>
          </Flex>
          )
        })}
      </Stack>
    </OptionsColumn>
  )
}

function Calendar() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [canLayoutChange, setCanLayoutChange] = useState(false)
  const { userData } = useAuth()
  const { calendarLayout } = usePersonalization()
  const { changeCalendarLayout } = useUserPersonalization()
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
  const now = dayjs()
  const monthWindow = useMemo(() => {
    const startOfMonth = now.startOf('month')
    const firstVisibleDay = startOfMonth.subtract(startOfMonth.day(), 'day')
    const lastVisibleDay = firstVisibleDay.add(41, 'day').endOf('day')

    return {
      timeMin: firstVisibleDay.startOf('day').toISOString(),
      timeMax: lastVisibleDay.toISOString()
    }
  }, [now])

  const calendarQuery = useQuery(
    calendarAPI.calendar.listPrimaryEvents
      .input({
        ...monthWindow,
        maxResults: 100
      })
      .queryOptions({
        enabled: Boolean(userData)
      })
  )
  const calendarState: CalendarState = {
    loading: calendarQuery.isLoading,
    errorMessage:
      calendarQuery.error instanceof Error ? calendarQuery.error.message : null,
    connected: calendarQuery.data?.connected ?? Boolean(userData?.googleConnected),
    calendarEnabled: calendarQuery.data?.calendarEnabled ?? false,
    events: calendarQuery.data?.events ?? []
  }

  const effectiveLayout = hasLayout(calendarLayout)
    ? calendarLayout
    : DEFAULT_CALENDAR_LAYOUT

  return (
    <Flex ref={wrapperRef} direction="column" flex="1" mb="2xl">
      <ModuleHeader
        contextMenuProps={{
          children: (
            <ContextMenuItem
              icon="tabler:pencil"
              label="Edit Layout"
              onClick={() => {
                setCanLayoutChange(current => !current)
              }}
            />
          )
        }}
      />
      <EditableModuleGrid
        canLayoutChange={canLayoutChange}
        items={[
          {
            id: 'month-view',
            component: ({ dimension }) => (
              <CalendarMonthView dimension={dimension} state={calendarState} />
            )
          },
          {
            id: 'today-overview',
            component: ({ dimension }) => (
              <TodayOverview dimension={dimension} state={calendarState} />
            )
          },
          {
            id: 'upcoming-days',
            component: ({ dimension }) => (
              <UpcomingDays dimension={dimension} state={calendarState} />
            )
          }
        ]}
        layout={effectiveLayout}
        wrapperRef={wrapperRef}
        onLayoutChange={changeCalendarLayout}
      />
      <EditableLayoutSaveBar
        canChange={canLayoutChange}
        label="You are editing calendar layout"
        setCanChange={setCanLayoutChange}
      />
    </Flex>
  )
}

export default Calendar
