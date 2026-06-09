import type {
  IBackdropFilters,
  IDashboardLayout
} from '../interfaces/personalization_provider_interfaces'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface PersistedPersonalization {
  version: 1
  updatedAt: number
  fontFamily?: string
  fontScale?: number
  borderRadiusMultiplier?: number
  bordered?: boolean
  theme?: ThemeMode
  rawThemeColor?: string
  bgTemp?: string
  backdropFilters?: IBackdropFilters
  language?: string
  dashboardLayout?: IDashboardLayout
}

export const PERSONALIZATION_STORAGE_KEY = 'lifeforge:personalization'

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function resolveThemeMode(
  theme: ThemeMode,
  systemPrefersDark: boolean
): 'light' | 'dark' {
  if (theme === 'system') {
    return systemPrefersDark ? 'dark' : 'light'
  }

  return theme
}

function isBackdropFilters(value: unknown): value is IBackdropFilters {
  return (
    typeof value === 'object' &&
    value !== null &&
    'blur' in value &&
    'brightness' in value &&
    'contrast' in value &&
    'saturation' in value &&
    'overlayOpacity' in value
  )
}

function isDashboardLayout(value: unknown): value is IDashboardLayout {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function sanitizePersistedPersonalization(
  value: unknown
): Partial<PersistedPersonalization> {
  if (typeof value !== 'object' || value === null) {
    return {}
  }

  const candidate = value as Record<string, unknown>
  const sanitized: Partial<PersistedPersonalization> = {}

  if (typeof candidate.updatedAt === 'number' && Number.isFinite(candidate.updatedAt)) {
    sanitized.updatedAt = candidate.updatedAt
  }

  if (typeof candidate.fontFamily === 'string') {
    sanitized.fontFamily = candidate.fontFamily
  }

  if (typeof candidate.fontScale === 'number' && Number.isFinite(candidate.fontScale)) {
    sanitized.fontScale = candidate.fontScale
  }

  if (
    typeof candidate.borderRadiusMultiplier === 'number' &&
    Number.isFinite(candidate.borderRadiusMultiplier)
  ) {
    sanitized.borderRadiusMultiplier = candidate.borderRadiusMultiplier
  }

  if (typeof candidate.bordered === 'boolean') {
    sanitized.bordered = candidate.bordered
  }

  if (isThemeMode(candidate.theme)) {
    sanitized.theme = candidate.theme
  }

  if (typeof candidate.rawThemeColor === 'string') {
    sanitized.rawThemeColor = candidate.rawThemeColor
  }

  if (typeof candidate.bgTemp === 'string') {
    sanitized.bgTemp = candidate.bgTemp
  }

  if (isBackdropFilters(candidate.backdropFilters)) {
    sanitized.backdropFilters = candidate.backdropFilters
  }

  if (typeof candidate.language === 'string') {
    sanitized.language = candidate.language
  }

  if (isDashboardLayout(candidate.dashboardLayout)) {
    sanitized.dashboardLayout = candidate.dashboardLayout
  }

  return sanitized
}

export function loadPersistedPersonalization(
  storage: Pick<Storage, 'getItem'>
): Partial<PersistedPersonalization> {
  try {
    const raw = storage.getItem(PERSONALIZATION_STORAGE_KEY)

    if (!raw) {
      return {}
    }

    return sanitizePersistedPersonalization(JSON.parse(raw))
  } catch {
    return {}
  }
}

export function savePersistedPersonalization(
  storage: Pick<Storage, 'setItem'>,
  payload: Omit<PersistedPersonalization, 'version' | 'updatedAt'>,
  now = Date.now()
): PersistedPersonalization {
  const snapshot: PersistedPersonalization = {
    version: 1,
    updatedAt: now,
    ...payload
  }

  storage.setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify(snapshot))

  return snapshot
}
