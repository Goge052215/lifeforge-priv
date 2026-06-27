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

function isStoredLayout(value: unknown): value is IDashboardLayout {
  return isDashboardLayout(value)
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
  changeCalendarLayout: (layout: IDashboardLayout) => Promise<void>
  changeIntegrationsLayout: (layout: IDashboardLayout) => Promise<void>
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
    setCalendarLayout,
    setIntegrationsLayout,
    setFontScale,
    setBgImage,
    setBorderRadiusMultiplier,
    setBordered
  } = usePersonalization()
  const pendingDashboardLayoutRef = useRef<IDashboardLayout | null>(null)
  const pendingCalendarLayoutRef = useRef<IDashboardLayout | null>(null)
  const pendingIntegrationsLayoutRef = useRef<IDashboardLayout | null>(null)

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

  async function changeCalendarLayout(layout: IDashboardLayout) {
    setCalendarLayout(layout)
    pendingCalendarLayoutRef.current = layout
    if (
      authLoading ||
      !auth ||
      !userData?.id ||
      typeof window === 'undefined' ||
      !window.localStorage.getItem('session')
    ) {
      return
    }

    if (await syncUserData({ calendarLayout: layout }, setUserData)) {
      pendingCalendarLayoutRef.current = null
    }
  }

  async function changeIntegrationsLayout(layout: IDashboardLayout) {
    setIntegrationsLayout(layout)
    pendingIntegrationsLayoutRef.current = layout
    if (
      authLoading ||
      !auth ||
      !userData?.id ||
      typeof window === 'undefined' ||
      !window.localStorage.getItem('session')
    ) {
      return
    }

    if (await syncUserData({ integrationsLayout: layout }, setUserData)) {
      pendingIntegrationsLayoutRef.current = null
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

    if (isStoredLayout(userData?.dashboardLayout)) {
      const hydratedDashboardLayout = normalizeDashboardLayout(
        userData.dashboardLayout
      )

      if (!pendingDashboardLayoutRef.current) {
        setDashboardLayout(hydratedDashboardLayout)
      }
    }

    if (isStoredLayout(userData?.calendarLayout)) {
      const hydratedCalendarLayout = normalizeDashboardLayout(userData.calendarLayout)

      if (!pendingCalendarLayoutRef.current) {
        setCalendarLayout(hydratedCalendarLayout)
      }
    }

    if (isStoredLayout(userData?.integrationsLayout)) {
      const hydratedIntegrationsLayout = normalizeDashboardLayout(
        userData.integrationsLayout
      )

      if (!pendingIntegrationsLayoutRef.current) {
        setIntegrationsLayout(hydratedIntegrationsLayout)
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

  useEffect(() => {
    if (
      authLoading ||
      !auth ||
      !userData?.id ||
      !pendingCalendarLayoutRef.current ||
      typeof window === 'undefined' ||
      !window.localStorage.getItem('session')
    ) {
      return
    }

    const pendingLayout = pendingCalendarLayoutRef.current

    void syncUserData({ calendarLayout: pendingLayout }, setUserData).then(
      success => {
        if (success && pendingCalendarLayoutRef.current === pendingLayout) {
          pendingCalendarLayoutRef.current = null
        }
      }
    )
  }, [auth, authLoading, userData?.id, setUserData])

  useEffect(() => {
    if (
      authLoading ||
      !auth ||
      !userData?.id ||
      !pendingIntegrationsLayoutRef.current ||
      typeof window === 'undefined' ||
      !window.localStorage.getItem('session')
    ) {
      return
    }

    const pendingLayout = pendingIntegrationsLayoutRef.current

    void syncUserData({ integrationsLayout: pendingLayout }, setUserData).then(
      success => {
        if (
          success &&
          pendingIntegrationsLayoutRef.current === pendingLayout
        ) {
          pendingIntegrationsLayoutRef.current = null
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
        changeCalendarLayout,
        changeIntegrationsLayout,
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
