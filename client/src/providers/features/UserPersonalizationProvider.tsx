import { createContext, useContext, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'

import {
  type IBackdropFilters,
  type IDashboardLayout,
  useAuth,
  usePersonalization
} from '@lifeforge/shared'

import forgeAPI from '@/forgeAPI'

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

function isDashboardLayout(value: unknown): value is IDashboardLayout {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toFiniteNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeDashboardLayout(value: unknown): IDashboardLayout {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }

  const candidate = value as Record<string, unknown>
  const rawLayouts =
    candidate.version === 1 &&
    typeof candidate.updatedAt === 'number' &&
    'layouts' in candidate
      ? candidate.layouts
      : candidate

  if (typeof rawLayouts !== 'object' || rawLayouts === null || Array.isArray(rawLayouts)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(rawLayouts).map(([breakpoint, items]) => [
      breakpoint,
      Array.isArray(items)
        ? items
            .filter(
              item =>
                typeof item === 'object' &&
                item !== null &&
                !Array.isArray(item) &&
                typeof (item as { i?: unknown }).i === 'string'
            )
            .map(item => {
              const layoutItem = item as Record<string, unknown>

              return {
                i: layoutItem.i as string,
                x: Math.max(0, toFiniteNumber(layoutItem.x, 0)),
                y: Math.max(0, toFiniteNumber(layoutItem.y, 0)),
                w: Math.max(1, toFiniteNumber(layoutItem.w, 1)),
                h: Math.max(1, toFiniteNumber(layoutItem.h, 1)),
                minW: Math.max(1, toFiniteNumber(layoutItem.minW, 1)),
                minH: Math.max(1, toFiniteNumber(layoutItem.minH, 1)),
                ...(typeof layoutItem.maxW === 'number' &&
                Number.isFinite(layoutItem.maxW)
                  ? { maxW: layoutItem.maxW }
                  : {}),
                ...(typeof layoutItem.maxH === 'number' &&
                Number.isFinite(layoutItem.maxH)
                  ? { maxH: layoutItem.maxH }
                  : {})
              }
            })
        : []
    ])
  )
}

function isThemeMode(value: unknown): value is 'light' | 'dark' | 'system' {
  return value === 'light' || value === 'dark' || value === 'system'
}

const UserPersonalizationContext = createContext<{
  changeFontFamily: (font: string) => Promise<void>
  changeFontScale: (scale: number) => Promise<void>
  changeTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>
  changeThemeColor: (color: string) => Promise<void>
  changeBgTemp: (color: string) => Promise<void>
  changeBackdropFilters: (filters: IBackdropFilters) => Promise<void>
  changeLanguage: (language: string) => Promise<void>
  changeDashboardLayout: (layout: IDashboardLayout) => Promise<void>
  changeBorderRadiusMultiplier: (multiplier: number) => Promise<void>
  changeBordered: (bordered: boolean) => Promise<void>
}>({} as any)

async function syncUserData(
  data: Record<string, unknown>,
  setUserData: React.Dispatch<React.SetStateAction<any>>
): Promise<boolean> {
  try {
    await forgeAPI.user.personalization.updatePersonalization.mutate({
      data
    })

    if (setUserData) {
      setUserData((oldData: any) => {
        if (!oldData) return oldData

        return { ...oldData, ...data }
      })
    }
    return true
  } catch {
    toast.error('Failed to update personalization settings')
    return false
  }
}

function UserPersonalizationProvider({
  children
}: {
  children: React.ReactNode
}) {
  const { auth, authLoading, userData, setUserData } = useAuth()

  const {
    setFontFamily,
    setTheme,
    setRawThemeColor,
    setBgTemp,
    setBackdropFilters,
    setLanguage,
    setDashboardLayout,
    setFontScale,
    setBgImage,
    setBorderRadiusMultiplier,
    setBordered
  } = usePersonalization()
  const pendingDashboardLayoutRef = useRef<IDashboardLayout | null>(null)

  async function changeFontFamily(font: string) {
    await syncUserData({ fontFamily: font }, setUserData)
  }

  async function changeFontScale(scale: number) {
    await syncUserData({ fontScale: scale }, setUserData)
  }

  async function changeTheme(theme: 'light' | 'dark' | 'system') {
    setTheme(theme)
    await syncUserData({ theme }, setUserData)
  }

  async function changeThemeColor(color: string) {
    setRawThemeColor(color)
    await syncUserData({ color: color.replace('theme-', '') }, setUserData)
  }

  async function changeBgTemp(color: string) {
    setBgTemp(color)
    await syncUserData({ bgTemp: color.replace('bg-', '') }, setUserData)
  }

  async function changeBackdropFilters(filters: IBackdropFilters) {
    setBackdropFilters(filters)
    await syncUserData({ backdropFilters: filters }, setUserData)
  }

  async function changeLanguage(language: string) {
    setLanguage(language)
    await syncUserData({ language }, setUserData)
  }

  async function changeDashboardLayout(layout: IDashboardLayout) {
    setDashboardLayout(layout)
    pendingDashboardLayoutRef.current = layout
    // #region debug-point A:dashboard-layout-sync-request
    fetch('http://127.0.0.1:7778/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'dashboard-layout-persistence', runId: 'pre-fix', hypothesisId: 'A', location: 'UserPersonalizationProvider.tsx:109', msg: '[DEBUG] requesting dashboard layout sync', data: { breakpoints: Object.keys(layout || {}), counts: Object.fromEntries(Object.entries(layout || {}).map(([key, value]) => [key, Array.isArray(value) ? value.length : -1])) }, ts: Date.now() }) }).catch(() => {})
    // #endregion
    if (
      authLoading ||
      !auth ||
      !userData?.id ||
      typeof window === 'undefined' ||
      !window.localStorage.getItem('session')
    ) {
      return
    }

    if (await syncUserData({ dashboardLayout: layout }, setUserData)) {
      pendingDashboardLayoutRef.current = null
    }
  }

  async function changeBorderRadiusMultiplier(multiplier: number) {
    setBorderRadiusMultiplier(multiplier)
    await syncUserData({ borderRadiusMultiplier: multiplier }, setUserData)
  }

  async function changeBordered(bordered: boolean) {
    setBordered(bordered)
    await syncUserData({ bordered }, setUserData)
  }

  useEffect(() => {
    // #region debug-point B:user-data-theme-hydration
    fetch((globalThis as typeof globalThis & { DEBUG_SERVER_URL?: string }).DEBUG_SERVER_URL || 'http://127.0.0.1:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: (globalThis as typeof globalThis & { DEBUG_SESSION_ID?: string }).DEBUG_SESSION_ID || 'theme-persistence', runId: 'pre-fix', hypothesisId: 'B', location: 'UserPersonalizationProvider.tsx:112', msg: '[DEBUG] hydrating personalization from user data', data: { hasUserData: Boolean(userData), theme: userData?.theme, color: userData?.color, bgTemp: userData?.bgTemp }, ts: Date.now() }) }).catch(() => {})
    // #endregion
    if (!userData) return

    if (isThemeMode(userData?.theme)) {
      setTheme(userData.theme)
    }

    if (isNonEmptyString(userData?.color)) {
      setRawThemeColor(
        userData.color.startsWith('#')
          ? userData.color
          : `theme-${userData.color}`
      )
    }

    if (isNonEmptyString(userData?.bgTemp)) {
      setBgTemp(
        userData.bgTemp.startsWith('#')
          ? userData.bgTemp
          : `bg-${userData.bgTemp}`
      )
    }

    if (userData?.backdropFilters) {
      setBackdropFilters(userData.backdropFilters)
    }

    if (isNonEmptyString(userData?.bgImage)) {
      setBgImage(
        forgeAPI.getMedia({
          collectionId: userData.collectionId,
          recordId: userData.id,
          fieldId: userData.bgImage
        })
      )
    } else {
      setBgImage('')
    }

    if (isNonEmptyString(userData?.language)) {
      setLanguage(userData.language)
    }

    if (isDashboardLayout(userData?.dashboardLayout)) {
      const hydratedDashboardLayout = normalizeDashboardLayout(
        userData.dashboardLayout
      )

      // #region debug-point C:dashboard-layout-hydration
      fetch('http://127.0.0.1:7778/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'dashboard-layout-persistence', runId: 'pre-fix', hypothesisId: 'C', location: 'UserPersonalizationProvider.tsx:169', msg: '[DEBUG] hydrating dashboard layout from user data', data: { breakpoints: Object.keys(hydratedDashboardLayout || {}), counts: Object.fromEntries(Object.entries(hydratedDashboardLayout || {}).map(([key, value]) => [key, Array.isArray(value) ? value.length : -1])) }, ts: Date.now() }) }).catch(() => {})
      // #endregion

      if (!pendingDashboardLayoutRef.current) {
        setDashboardLayout(hydratedDashboardLayout)
      }
    }

    if (userData?.fontFamily !== undefined) {
      setFontFamily(userData.fontFamily)
    }

    if (userData?.fontScale !== undefined) {
      setFontScale(userData.fontScale)
    }

    if (userData?.borderRadiusMultiplier !== undefined) {
      setBorderRadiusMultiplier(userData.borderRadiusMultiplier)
    }

    if (userData?.bordered !== undefined) {
      setBordered(userData.bordered)
    }
  }, [userData])

  useEffect(() => {
    if (
      authLoading ||
      !auth ||
      !userData?.id ||
      !pendingDashboardLayoutRef.current ||
      typeof window === 'undefined' ||
      !window.localStorage.getItem('session')
    ) {
      return
    }

    const pendingLayout = pendingDashboardLayoutRef.current

    void syncUserData({ dashboardLayout: pendingLayout }, setUserData).then(
      success => {
        if (success && pendingDashboardLayoutRef.current === pendingLayout) {
          pendingDashboardLayoutRef.current = null
        }
      }
    )
  }, [auth, authLoading, userData?.id, setUserData])

  return (
    <UserPersonalizationContext
      value={{
        changeFontFamily,
        changeFontScale,
        changeTheme,
        changeThemeColor,
        changeBgTemp,
        changeBackdropFilters,
        changeLanguage,
        changeDashboardLayout,
        changeBorderRadiusMultiplier,
        changeBordered
      }}
    >
      {children}
    </UserPersonalizationContext>
  )
}

export default UserPersonalizationProvider

export function useUserPersonalization() {
  const context = useContext(UserPersonalizationContext)

  if (!context) {
    throw new Error(
      'useUserPersonalization must be used within a UserPersonalizationProvider'
    )
  }

  return context
}
