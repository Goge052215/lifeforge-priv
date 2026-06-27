import dayjs from 'dayjs'
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import ReactClock from 'react-clock'
import tinycolor from 'tinycolor2'

import {
  useDivSize,
  usePersonalization,
  type WidgetConfig
} from '@lifeforge/shared'
import { Card, Flex, Stack, Text } from '@lifeforge/ui'

import 'react-clock/dist/Clock.css'
import './RoundClock.css'

function formatTimeZoneLabel() {
  const parts = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/')

  return parts[parts.length - 1]?.split('_').join(' ') || 'Local Time'
}

function RoundClockWidget({
  dimension: { w, h }
}: {
  dimension: { w: number; h: number }
}) {
  const [value, setValue] = useState(new Date())
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { width, height } = useDivSize(containerRef)
  const { derivedThemeColor, language } = usePersonalization()
  const compact = w <= 2 || h <= 2
  const showMeta = h >= 2
  const useMinuteMarks = w >= 3 && h >= 2
  const showSecondHand = h >= 3
  const clockSize = useMemo(() => {
    const availableWidth = Math.max((width || 220) - 28, 96)
    const reservedHeight = showMeta ? (compact ? 64 : 80) : 28
    const availableHeight = Math.max((height || 220) - reservedHeight, 96)

    return Math.max(
      96,
      Math.min(availableWidth, availableHeight, compact ? 180 : 240)
    )
  }, [compact, height, showMeta, width])
  const accentColor = useMemo(
    () => tinycolor(derivedThemeColor).brighten(3).toHexString(),
    [derivedThemeColor]
  )
  const accentGlow = useMemo(
    () => tinycolor(derivedThemeColor).setAlpha(0.24).toRgbString(),
    [derivedThemeColor]
  )
  const accentSoft = useMemo(
    () => tinycolor(derivedThemeColor).setAlpha(0.12).toRgbString(),
    [derivedThemeColor]
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setValue(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <Card
      ref={containerRef}
      className="round-clock-widget"
      gap={compact ? 'sm' : 'md'}
      height="100%"
      justify="between"
      style={
        {
          '--round-clock-accent': accentColor,
          '--round-clock-accent-glow': accentGlow,
          '--round-clock-accent-soft': accentSoft
        } as CSSProperties
      }
    >
      <Flex centered flex="1" minHeight="0">
        <div
          className="round-clock-widget__dial"
          style={{
            height: `${clockSize}px`,
            width: `${clockSize}px`
          }}
        >
          <ReactClock
            className="round-clock-widget__clock"
            hourHandLength={50}
            hourHandOppositeLength={12}
            hourHandWidth={compact ? 4 : 5}
            hourMarksLength={compact ? 8 : 10}
            hourMarksWidth={compact ? 2 : 3}
            locale={language}
            minuteHandLength={72}
            minuteHandOppositeLength={16}
            minuteHandWidth={compact ? 2 : 3}
            minuteMarksLength={4}
            minuteMarksWidth={1}
            renderMinuteMarks={useMinuteMarks}
            renderNumbers={false}
            renderSecondHand={showSecondHand}
            secondHandLength={82}
            secondHandOppositeLength={18}
            secondHandWidth={1}
            size={clockSize}
            value={value}
          />
        </div>
      </Flex>

      {showMeta ? (
        <Flex
          align={compact ? 'start' : 'center'}
          direction={compact ? 'column' : 'row'}
          justify="between"
          minWidth="0"
        >
          <Stack gap="xs" minWidth="0">
            <Text weight="semibold">{dayjs(value).format('HH:mm:ss')}</Text>
            <Text color="muted" size="sm">
              {formatTimeZoneLabel()}
            </Text>
          </Stack>
          <Text color="muted" size="sm">
            {dayjs(value).locale(language).format(compact ? 'ddd, MMM D' : 'dddd, MMM D')}
          </Text>
        </Flex>
      ) : null}
    </Card>
  )
}

export default RoundClockWidget

export const config: WidgetConfig = {
  id: 'roundClock',
  icon: 'tabler:clock-hour-10',
  minW: 2,
  minH: 2,
  maxW: 4,
  maxH: 4
}
