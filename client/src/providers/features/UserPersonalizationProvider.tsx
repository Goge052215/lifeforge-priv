import { createContext, useContext, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'

import {
  type IBackdropFilters,
  type IDashboardLayout,
  useAuth,
  usePersonalization
} from '@lifeforge/shared'

import forgeAPI from '@/forgeAPI'

function reportPersonalizationDebug(
  level: 'info' | 'warn' | 'error',
  msg: string,
  data: Record<string, unknown>
) {
  console[level](`[personalization-401-loop] ${msg}`, data)
}

function createDebugTraceId(scope: string) {
  return `${scope}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

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

function isAuthFailureMessage(message: string) {
  return (
    message === 'Invalid authorization credentials' ||
    message === 'Authorization token is required'
  )
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
  setUserData: React.Dispatch<React.SetStateAction<any>>,
  onAuthFailure?: () => void,
  debugContext?: {
    source: string
    traceId: string
  }
): Promise<boolean> {
  // #region debug-point B:sync-user-data-entry
  reportPersonalizationDebug(
    'info',
    'personalization sync started',
    {
      location: 'UserPersonalizationProvider.tsx:syncUserData:entry',
      dataKeys: Object.keys(data),
      source: debugContext?.source ?? 'unknown',
      traceId: debugContext?.traceId
    }
  )
  // #endregion
  try {
    await forgeAPI.user.personalization.updatePersonalization.mutate({
      data
    })

    // #region debug-point B:sync-user-data-success
    reportPersonalizationDebug(
      'info',
      'personalization sync succeeded',
      {
        location: 'UserPersonalizationProvider.tsx:syncUserData:success',
        dataKeys: Object.keys(data),
        source: debugContext?.source ?? 'unknown',
        traceId: debugContext?.traceId
      }
    )
    // #endregion
    if (setUserData) {
      setUserData((oldData: any) => {
        if (!oldData) return oldData

        return { ...oldData, ...data }
      })
    }
    return true
  } catch (error) {
    // #region debug-point B:sync-user-data-failure
    reportPersonalizationDebug(
      'warn',
      'personalization sync failed',
      {
        location: 'UserPersonalizationProvider.tsx:syncUserData:failure',
        dataKeys: Object.keys(data),
        source: debugContext?.source ?? 'unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        traceId: debugContext?.traceId
      }
    )
    // #endregion
    if (error instanceof Error && isAuthFailureMessage(error.message)) {
      onAuthFailure?.()
      toast.error('Your session expired. Sign in again to save personalization.')
      return false
    }

    toast.error('Failed to update personalization settings')
    return false
  }
}

function UserPersonalizationProvider({
  children
}: {
  children: React.ReactNode
}) {
  const { auth, authLoading, userData, setUserData, logout } = useAuth()

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

  function handlePersistenceAuthFailure() {
    // #region debug-point C:persistence-auth-failure
    reportPersonalizationDebug(
      'warn',
      'personalization auth failure handler invoked',
      {
        location: 'UserPersonalizationProvider.tsx:handlePersistenceAuthFailure',
        hasPendingDashboardLayout: Boolean(pendingDashboardLayoutRef.current),
        hasPendingCalendarLayout: Boolean(pendingCalendarLayoutRef.current),
        hasPendingIntegrationsLayout: Boolean(pendingIntegrationsLayoutRef.current),
        hasSession:
          typeof window !== 'undefined' &&
          Boolean(window.localStorage.getItem('session'))
      }
    )
    // #endregion
    pendingDashboardLayoutRef.current = null
    pendingCalendarLayoutRef.current = null
    pendingIntegrationsLayoutRef.current = null
    logout()
  }

  async function changeFontFamily(font: string) {
    await syncUserData({ fontFamily: font }, setUserData, handlePersistenceAuthFailure)
  }

  async function changeFontScale(scale: number) {
    await syncUserData({ fontScale: scale }, setUserData, handlePersistenceAuthFailure)
  }

  async function changeTheme(theme: 'light' | 'dark' | 'system') {
    setTheme(theme)
    await syncUserData({ theme }, setUserData, handlePersistenceAuthFailure)
  }

  async function changeThemeColor(color: string) {
    setRawThemeColor(color)
    await syncUserData(
      { color: color.replace('theme-', '') },
      setUserData,
      handlePersistenceAuthFailure
    )
  }

  async function changeBgTemp(color: string) {
    setBgTemp(color)
    await syncUserData(
      { bgTemp: color.replace('bg-', '') },
      setUserData,
      handlePersistenceAuthFailure
    )
  }

  async function changeBackdropFilters(filters: IBackdropFilters) {
    setBackdropFilters(filters)
    await syncUserData(
      { backdropFilters: filters },
      setUserData,
      handlePersistenceAuthFailure
    )
  }

  async function changeLanguage(language: string) {
    setLanguage(language)
    await syncUserData({ language }, setUserData, handlePersistenceAuthFailure)
  }

  async function changeDashboardLayout(layout: IDashboardLayout) {
    const traceId = createDebugTraceId('dashboard-immediate')
    setDashboardLayout(layout)
    pendingDashboardLayoutRef.current = layout
    // #region debug-point B:change-dashboard-layout-entry
    reportPersonalizationDebug(
      'info',
      'dashboard layout change received',
      {
        location: 'UserPersonalizationProvider.tsx:changeDashboardLayout:entry',
        authLoading,
        hasAuth: Boolean(auth),
        hasUserId: Boolean(userData?.id),
        hasSession:
          typeof window !== 'undefined' &&
          Boolean(window.localStorage.getItem('session')),
        pendingBreakpoints: Object.keys(layout || {}),
        traceId
      }
    )
    // #endregion
    if (
      authLoading ||
      !auth ||
      !userData?.id ||
      typeof window === 'undefined' ||
      !window.localStorage.getItem('session')
    ) {
      // #region debug-point B:change-dashboard-layout-skipped
      reportPersonalizationDebug(
        'info',
        'dashboard layout change skipped sync',
        {
          location: 'UserPersonalizationProvider.tsx:changeDashboardLayout:skipped',
          authLoading,
          hasAuth: Boolean(auth),
          hasUserId: Boolean(userData?.id),
          hasSession:
            typeof window !== 'undefined' &&
            Boolean(window.localStorage.getItem('session')),
          traceId
        }
      )
      // #endregion
      return
    }

    if (
      await syncUserData(
        { dashboardLayout: layout },
        setUserData,
        handlePersistenceAuthFailure,
        { source: 'changeDashboardLayout', traceId }
      )
    ) {
      pendingDashboardLayoutRef.current = null
    }
  }

  async function changeCalendarLayout(layout: IDashboardLayout) {
    const traceId = createDebugTraceId('calendar-immediate')
    setCalendarLayout(layout)
    pendingCalendarLayoutRef.current = layout
    // #region debug-point B:change-calendar-layout-entry
    reportPersonalizationDebug(
      'info',
      'calendar layout change received',
      {
        location: 'UserPersonalizationProvider.tsx:changeCalendarLayout:entry',
        authLoading,
        hasAuth: Boolean(auth),
        hasUserId: Boolean(userData?.id),
        hasSession:
          typeof window !== 'undefined' &&
          Boolean(window.localStorage.getItem('session')),
        pendingBreakpoints: Object.keys(layout || {}),
        traceId
      }
    )
    // #endregion
    if (
      authLoading ||
      !auth ||
      !userData?.id ||
      typeof window === 'undefined' ||
      !window.localStorage.getItem('session')
    ) {
      // #region debug-point B:change-calendar-layout-skipped
      reportPersonalizationDebug(
        'info',
        'calendar layout change skipped sync',
        {
          location: 'UserPersonalizationProvider.tsx:changeCalendarLayout:skipped',
          authLoading,
          hasAuth: Boolean(auth),
          hasUserId: Boolean(userData?.id),
          hasSession:
            typeof window !== 'undefined' &&
            Boolean(window.localStorage.getItem('session')),
          traceId
        }
      )
      // #endregion
      return
    }

    if (
      await syncUserData(
        { calendarLayout: layout },
        setUserData,
        handlePersistenceAuthFailure,
        { source: 'changeCalendarLayout', traceId }
      )
    ) {
      pendingCalendarLayoutRef.current = null
    }
  }

  async function changeIntegrationsLayout(layout: IDashboardLayout) {
    const traceId = createDebugTraceId('integrations-immediate')
    setIntegrationsLayout(layout)
    pendingIntegrationsLayoutRef.current = layout
    // #region debug-point B:change-integrations-layout-entry
    reportPersonalizationDebug(
      'info',
      'integrations layout change received',
      {
        location: 'UserPersonalizationProvider.tsx:changeIntegrationsLayout:entry',
        authLoading,
        hasAuth: Boolean(auth),
        hasUserId: Boolean(userData?.id),
        hasSession:
          typeof window !== 'undefined' &&
          Boolean(window.localStorage.getItem('session')),
        pendingBreakpoints: Object.keys(layout || {}),
        traceId
      }
    )
    // #endregion
    if (
      authLoading ||
      !auth ||
      !userData?.id ||
      typeof window === 'undefined' ||
      !window.localStorage.getItem('session')
    ) {
      // #region debug-point B:change-integrations-layout-skipped
      reportPersonalizationDebug(
        'info',
        'integrations layout change skipped sync',
        {
          location:
            'UserPersonalizationProvider.tsx:changeIntegrationsLayout:skipped',
          authLoading,
          hasAuth: Boolean(auth),
          hasUserId: Boolean(userData?.id),
          hasSession:
            typeof window !== 'undefined' &&
            Boolean(window.localStorage.getItem('session')),
          traceId
        }
      )
      // #endregion
      return
    }

    if (
      await syncUserData(
        { integrationsLayout: layout },
        setUserData,
        handlePersistenceAuthFailure,
        { source: 'changeIntegrationsLayout', traceId }
      )
    ) {
      pendingIntegrationsLayoutRef.current = null
    }
  }

  async function changeBorderRadiusMultiplier(multiplier: number) {
    setBorderRadiusMultiplier(multiplier)
    await syncUserData(
      { borderRadiusMultiplier: multiplier },
      setUserData,
      handlePersistenceAuthFailure
    )
  }

  async function changeBordered(bordered: boolean) {
    setBordered(bordered)
    await syncUserData({ bordered }, setUserData, handlePersistenceAuthFailure)
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
    const traceId = createDebugTraceId('dashboard-effect')

    // #region debug-point E:dashboard-effect-entry
    reportPersonalizationDebug(
      'info',
      'dashboard pending layout effect triggered',
      {
        location: 'UserPersonalizationProvider.tsx:dashboardEffect:entry',
        hasPendingLayout: Boolean(pendingLayout),
        pendingBreakpoints: Object.keys(pendingLayout || {}),
        traceId
      }
    )
    // #endregion

    void syncUserData(
      { dashboardLayout: pendingLayout },
      setUserData,
      handlePersistenceAuthFailure,
      { source: 'dashboardEffect', traceId }
    ).then(
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
    const traceId = createDebugTraceId('calendar-effect')

    // #region debug-point E:calendar-effect-entry
    reportPersonalizationDebug(
      'info',
      'calendar pending layout effect triggered',
      {
        location: 'UserPersonalizationProvider.tsx:calendarEffect:entry',
        hasPendingLayout: Boolean(pendingLayout),
        pendingBreakpoints: Object.keys(pendingLayout || {}),
        traceId
      }
    )
    // #endregion

    void syncUserData(
      { calendarLayout: pendingLayout },
      setUserData,
      handlePersistenceAuthFailure,
      { source: 'calendarEffect', traceId }
    ).then(
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
    const traceId = createDebugTraceId('integrations-effect')

    // #region debug-point E:integrations-effect-entry
    reportPersonalizationDebug(
      'info',
      'integrations pending layout effect triggered',
      {
        location: 'UserPersonalizationProvider.tsx:integrationsEffect:entry',
        hasPendingLayout: Boolean(pendingLayout),
        pendingBreakpoints: Object.keys(pendingLayout || {}),
        traceId
      }
    )
    // #endregion

    void syncUserData(
      { integrationsLayout: pendingLayout },
      setUserData,
      handlePersistenceAuthFailure,
      { source: 'integrationsEffect', traceId }
    ).then(
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
