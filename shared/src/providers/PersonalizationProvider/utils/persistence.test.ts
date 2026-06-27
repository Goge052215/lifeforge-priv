/// <reference types="bun-types" />

import { describe, expect, it } from 'bun:test'

import {
  loadPersistedPersonalization,
  resolveThemeMode,
  savePersistedPersonalization,
  sanitizePersistedPersonalization
} from './persistence'

function createStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))

  return {
    getItem(key: string) {
      return data.get(key) ?? null
    },
    setItem(key: string, value: string) {
      data.set(key, value)
    }
  }
}

describe('personalization persistence', () => {
  it('persists a manually selected dark theme across storage reloads', () => {
    const storage = createStorage()

    savePersistedPersonalization(
      storage,
      {
        theme: 'dark',
        rawThemeColor: 'theme-lime',
        bgTemp: 'bg-neutral',
        bgImage: 'https://example.com/bg.webp',
        language: 'en',
        calendarLayout: {
          lg: [
            {
              i: 'month',
              x: 0,
              y: 0,
              w: 4,
              h: 4,
              minW: 2,
              minH: 2
            }
          ]
        },
        integrationsLayout: {
          lg: [
            {
              i: 'google',
              x: 0,
              y: 0,
              w: 4,
              h: 3,
              minW: 2,
              minH: 2
            }
          ]
        }
      },
      123
    )

    expect(loadPersistedPersonalization(storage)).toMatchObject({
      theme: 'dark',
      rawThemeColor: 'theme-lime',
      bgTemp: 'bg-neutral',
      bgImage: 'https://example.com/bg.webp',
      language: 'en',
      calendarLayout: {
        lg: [
          {
            i: 'month',
            x: 0,
            y: 0,
            w: 4,
            h: 4,
            minW: 2,
            minH: 2
          }
        ]
      },
      integrationsLayout: {
        lg: [
          {
            i: 'google',
            x: 0,
            y: 0,
            w: 4,
            h: 3,
            minW: 2,
            minH: 2
          }
        ]
      },
      updatedAt: 123
    })
  })

  it('ignores malformed persisted theme values', () => {
    expect(
      sanitizePersistedPersonalization({
        theme: 'sepia',
        rawThemeColor: 'theme-lime'
      })
    ).toEqual({
      rawThemeColor: 'theme-lime'
    })
  })
})

describe('system theme resolution', () => {
  it('resolves system theme to dark when the host prefers dark mode', () => {
    expect(resolveThemeMode('system', true)).toBe('dark')
  })

  it('resolves system theme to light when the host prefers light mode', () => {
    expect(resolveThemeMode('system', false)).toBe('light')
  })

  it('preserves explicit manual theme selections', () => {
    expect(resolveThemeMode('dark', false)).toBe('dark')
    expect(resolveThemeMode('light', true)).toBe('light')
  })
})
