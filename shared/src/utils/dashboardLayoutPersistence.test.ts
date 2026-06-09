/// <reference types="bun-types" />

import { describe, expect, it } from 'bun:test'

import {
  deserializeDashboardLayout,
  serializeDashboardLayout
} from './dashboardLayoutPersistence'

describe('dashboard layout persistence', () => {
  it('serializes raw layouts into a versioned payload', () => {
    const payload = serializeDashboardLayout(
      {
        lg: [
          {
            i: 'weather',
            x: 1,
            y: 2,
            w: 4,
            h: 3,
            minW: 2,
            minH: 2
          }
        ]
      },
      123
    )

    expect(payload).toEqual({
      version: 1,
      updatedAt: 123,
      layouts: {
        lg: [
          {
            i: 'weather',
            x: 1,
            y: 2,
            w: 4,
            h: 3,
            minW: 2,
            minH: 2
          }
        ]
      }
    })
  })

  it('deserializes both versioned and legacy layout payloads', () => {
    const versioned = deserializeDashboardLayout({
      version: 1,
      updatedAt: 123,
      layouts: {
        lg: [
          {
            i: 'weather',
            x: 0,
            y: 0,
            w: 4,
            h: 4,
            minW: 2,
            minH: 2
          }
        ]
      }
    })

    const legacy = deserializeDashboardLayout({
      lg: [
        {
          i: 'calendar',
          x: 2,
          y: 3,
          w: 5,
          h: 6,
          minW: 2,
          minH: 2
        }
      ]
    })

    expect(versioned.lg?.[0]?.i).toBe('weather')
    expect(legacy.lg?.[0]?.i).toBe('calendar')
  })

  it('normalizes non-finite coordinates before persistence', () => {
    const payload = serializeDashboardLayout({
      lg: [
        {
          i: 'notes',
          x: 0,
          y: Infinity,
          w: 4,
          h: 4,
          minW: 1,
          minH: 1
        }
      ]
    })

    expect(payload.layouts.lg?.[0]?.y).toBe(0)
  })
})
