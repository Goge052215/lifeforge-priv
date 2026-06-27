import { useQuery } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import { type CSSProperties, useMemo, useState } from 'react'
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

type CalendarStage = 1 | 2 | 3 | 4

type CalendarStageConfig = {
  stage: CalendarStage
  weekdayLabels: string[]
  monthFormat: string
  gridGap: string
  showCellBlocks: boolean
  showSelectedDatePanel: boolean
  showEventList: boolean
  showMonthSummary: boolean
  cellMinHeight: string
  dayTextSize: 'xs' | 'sm' | 'base'
}

type CalendarStageBoundary = {
  label: 'mini' | 'compact' | 'standard' | 'detail'
  stage: CalendarStage
  matches: (size: { w: number; h: number }) => boolean
}

// Stage documentation for future maintenance:
// Level 1: Bare compact month grid, no day blocks, initials only, selection via subtle ring.
// Level 2: Expanded compact grid, no day blocks, short weekday labels, event dots/counts.
// Level 3: Card-based day cells, full month label, month summary, no detailed agenda panel.
// Level 4: Full card-based grid with selected-day detail panel and richer month summary.
const CALENDAR_STAGE_CONFIG: Record<CalendarStage, CalendarStageConfig> = {
  1: {
    stage: 1,
    weekdayLabels: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    monthFormat: 'MMM YYYY',
    gridGap: '0.12rem',
    showCellBlocks: false,
    showSelectedDatePanel: false,
    showEventList: false,
    showMonthSummary: false,
    cellMinHeight: '1.45rem',
    dayTextSize: 'xs'
  },
  2: {
    stage: 2,
    weekdayLabels: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    monthFormat: 'MMM YYYY',
    gridGap: '0.2rem',
    showCellBlocks: false,
    showSelectedDatePanel: false,
    showEventList: false,
    showMonthSummary: true,
    cellMinHeight: '1.9rem',
    dayTextSize: 'sm'
  },
  3: {
    stage: 3,
    weekdayLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    monthFormat: 'MMMM YYYY',
    gridGap: '0.3rem',
    showCellBlocks: true,
    showSelectedDatePanel: false,
    showEventList: false,
    showMonthSummary: true,
    cellMinHeight: '2.5rem',
    dayTextSize: 'sm'
  },
  4: {
    stage: 4,
    weekdayLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    monthFormat: 'MMMM YYYY',
    gridGap: '0.35rem',
    showCellBlocks: true,
    showSelectedDatePanel: true,
    showEventList: true,
    showMonthSummary: true,
    cellMinHeight: '3rem',
    dayTextSize: 'sm'
  }
}

// Explicit stage boundaries:
// mini: very small tiles where height is 2 or less, or narrow 2-column tiles up to height 3
// compact: any remaining narrow width<=2 or short height<=3 tiles
// standard: mid-size tiles up to width 3 or height 4
// detail: larger tiles that can support summary + selected-day detail
const CALENDAR_STAGE_BOUNDARIES: CalendarStageBoundary[] = [
  {
    label: 'mini',
    stage: 1,
    matches: ({ w, h }) => h <= 2 || (w <= 2 && h <= 3)
  },
  {
    label: 'compact',
    stage: 2,
    matches: ({ w, h }) => w <= 2 || h <= 3
  },
  {
    label: 'standard',
    stage: 3,
    matches: ({ w, h }) => w <= 3 || h <= 4
  },
  {
    label: 'detail',
    stage: 4,
    matches: () => true
  }
]

function getCalendarStage(w: number, h: number): CalendarStage {
  const matchedBoundary = CALENDAR_STAGE_BOUNDARIES.find(boundary =>
    boundary.matches({ w, h })
  )

  return matchedBoundary?.stage ?? 4
}

function getMonthCells(month: Dayjs) {
  const startOfMonth = month.startOf('month')
  const firstVisibleDay = startOfMonth.subtract(startOfMonth.day(), 'day')

  return Array.from({ length: 42 }, (_, index) => {
    const date = firstVisibleDay.add(index, 'day')

    return {
      key: date.format('YYYY-MM-DD'),
      date,
      isCurrentMonth: date.month() === month.month(),
      isToday: date.isSame(dayjs(), 'day')
    }
  })
}

function getMonthWindow(month: Dayjs) {
  const startOfMonth = month.startOf('month')
  const firstVisibleDay = startOfMonth.subtract(startOfMonth.day(), 'day')
  const lastVisibleDay = firstVisibleDay.add(41, 'day').endOf('day')

  return {
    timeMin: firstVisibleDay.startOf('day').toISOString(),
    timeMax: lastVisibleDay.toISOString()
  }
}

function getCompactCellButtonStyle({
  stage,
  isCurrentMonth,
  isSelected,
  isToday
}: {
  stage: CalendarStage
  isCurrentMonth: boolean
  isSelected: boolean
  isToday: boolean
}): CSSProperties {
  const compact = stage === 1

  return {
    alignItems: 'center',
    background: isSelected ? 'rgba(195, 214, 53, 0.16)' : 'transparent',
    border: 'none',
    borderRadius: '9999px',
    boxShadow: isSelected
      ? 'inset 0 0 0 1px rgba(195, 214, 53, 0.5)'
      : isToday
        ? 'inset 0 0 0 1px rgba(255,255,255,0.16)'
        : 'none',
    color: isSelected
      ? '#c3d635'
      : isToday
        ? '#f8fafc'
        : isCurrentMonth
          ? '#e5e7eb'
          : 'rgba(229, 231, 235, 0.38)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    fontSize: compact ? '0.75rem' : '0.85rem',
    fontWeight: isSelected || isToday ? 600 : 500,
    gap: compact ? '0.08rem' : '0.12rem',
    height: '100%',
    justifyContent: 'center',
    lineHeight: 1,
    minHeight: compact ? '1.45rem' : '1.9rem',
    padding: compact ? '0.12rem 0' : '0.18rem 0',
    width: '100%'
  }
}

function CalendarWidget({
  dimension: { w, h }
}: {
  dimension: { w: number; h: number }
}) {
  const { userData } = useAuth()
  const googleConnected = Boolean(userData?.googleConnected)
  const [focusedMonth, setFocusedMonth] = useState(() => dayjs().startOf('month'))
  const [selectedDate, setSelectedDate] = useState(() => dayjs())
  const stage = getCalendarStage(w, h)
  const stageConfig = CALENDAR_STAGE_CONFIG[stage]
  const monthKey = focusedMonth.format('YYYY-MM')
  const monthWindow = useMemo(() => getMonthWindow(focusedMonth), [monthKey])
  const monthCells = useMemo(() => getMonthCells(focusedMonth), [monthKey])
  const selectedDateKey = selectedDate.format('YYYY-MM-DD')
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

  function changeMonth(offset: number) {
    const nextMonth = focusedMonth.add(offset, 'month').startOf('month')

    setFocusedMonth(nextMonth)
    setSelectedDate(currentSelection =>
      currentSelection.month() === nextMonth.month() &&
      currentSelection.year() === nextMonth.year()
        ? currentSelection
        : nextMonth
    )
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
  const selectedDateEvents = useMemo(
    () => syncedEvents.filter(event => event.startDateKey === selectedDateKey),
    [selectedDateKey, syncedEvents]
  )

  return (
    <Card gap={stage <= 2 ? 'sm' : 'md'} height="100%" justify="between">
      <Flex align="start" justify="between">
        <Stack gap="xs" minWidth="0">
          <Text as="h3" size={stage === 1 ? 'base' : 'lg'} weight="semibold">
            Calendar
          </Text>
          <Flex align="center" gap="xs" wrap="wrap">
            <Button
              icon="tabler:chevron-left"
              p="xs"
              variant="plain"
              onClick={() => changeMonth(-1)}
            />
            <Text color="muted" size="sm">
              {focusedMonth.format(stageConfig.monthFormat)}
            </Text>
            <Button
              icon="tabler:chevron-right"
              p="xs"
              variant="plain"
              onClick={() => changeMonth(1)}
            />
          </Flex>
        </Stack>

        <Flex align="center" gap="xs">
          {!googleConnected || !calendarEnabled ? (
            <Button
              icon="tabler:brand-google"
              loading={linkLoading}
              p={stage <= 2 ? 'sm' : 'md'}
              onClick={startLinkFlow}
            >
              {stage === 1 ? 'Link' : 'Link Google'}
            </Button>
          ) : stageConfig.showMonthSummary ? (
            <Text color="muted" size="sm">
              {syncedEvents.length} synced
            </Text>
          ) : null}
        </Flex>
      </Flex>

      <div
        style={{
          display: 'grid',
          gap: stageConfig.gridGap,
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))'
        }}
      >
        {stageConfig.weekdayLabels.map(day => (
          <Text
            key={day}
            align="center"
            color="muted"
            size={stage === 1 ? 'xs' : 'sm'}
            weight="medium"
          >
            {day}
          </Text>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gap: stageConfig.gridGap,
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))'
        }}
      >
        {monthCells.map(({ key, date, isCurrentMonth, isToday }) => {
          const dayKey = date.format('YYYY-MM-DD')
          const dayEventCount = eventCountByDay[dayKey] ?? 0
          const isSelected = dayKey === selectedDateKey

          if (!stageConfig.showCellBlocks) {
            return (
              <button
                key={key}
                style={getCompactCellButtonStyle({
                  stage,
                  isCurrentMonth,
                  isSelected,
                  isToday
                })}
                type="button"
                onClick={() => setSelectedDate(date)}
              >
                <span>{date.date()}</span>
                {stage === 2 && dayEventCount > 0 ? (
                  <span
                    style={{
                      background: isSelected ? '#c3d635' : 'rgba(195, 214, 53, 0.8)',
                      borderRadius: '9999px',
                      display: 'block',
                      height: '0.22rem',
                      width: '0.22rem'
                    }}
                  />
                ) : null}
              </button>
            )
          }

          return (
            <Box
              key={key}
              bg={
                isSelected
                  ? 'custom-500'
                  : isToday
                    ? { base: 'bg-300', dark: 'bg-700' }
                    : isCurrentMonth
                      ? { base: 'bg-200', dark: 'bg-800' }
                      : { base: 'bg-100', dark: 'bg-900' }
              }
              minHeight={stageConfig.cellMinHeight}
              p={stage === 3 ? 'xs' : 'sm'}
              r="lg"
            >
              <button
                style={{
                  alignItems: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: isSelected
                    ? '#0f172a'
                    : isCurrentMonth
                      ? '#e5e7eb'
                      : 'rgba(229, 231, 235, 0.42)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.1rem',
                  height: '100%',
                  justifyContent: 'center',
                  padding: 0,
                  width: '100%'
                }}
                type="button"
                onClick={() => setSelectedDate(date)}
              >
                <Text
                  align="center"
                  color={isSelected ? 'bg-900' : isToday ? 'primary' : undefined}
                  size={stageConfig.dayTextSize}
                  weight={isSelected || isToday ? 'semibold' : 'medium'}
                >
                  {date.date()}
                </Text>
                {dayEventCount > 0 ? (
                  <Text
                    align="center"
                    color={isSelected ? 'bg-900' : 'primary'}
                    size="xs"
                    weight="medium"
                  >
                    {dayEventCount}
                  </Text>
                ) : null}
              </button>
            </Box>
          )
        })}
      </div>

      {stageConfig.showSelectedDatePanel ? (
        <Stack
          bg={{ base: 'bg-100', dark: 'bg-900' }}
          gap="sm"
          p="sm"
          r="lg"
          width="100%"
        >
          <Flex align="center" justify="between">
            <Text weight="semibold">{selectedDate.format('dddd, MMM D')}</Text>
            <Text color="muted" size="sm">
              {selectedDateEvents.length} event
              {selectedDateEvents.length === 1 ? '' : 's'}
            </Text>
          </Flex>
          {googleConnected && calendarEnabled && stageConfig.showEventList ? (
            selectedDateEvents.length > 0 ? (
              <Stack gap="xs">
                {selectedDateEvents.slice(0, 3).map(event => (
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
                          : dayjs(event.start).format('h:mm A')}
                      </Text>
                    </Stack>
                    <Text color="muted" size="sm">
                      {dayjs(event.start).format('ddd')}
                    </Text>
                  </Flex>
                ))}
              </Stack>
            ) : (
              <Text color="muted" size="sm">
                No synced events for the selected day.
              </Text>
            )
          ) : (
            <Text color="muted" size="sm">
              Select a day to inspect it. Link Google for synced events.
            </Text>
          )}
        </Stack>
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
