import type {
  IDashboardLayout,
  IDashboardLayoutItem
} from '../providers/PersonalizationProvider/interfaces/personalization_provider_interfaces'

export interface PersistedDashboardLayout {
  version: 1
  updatedAt: number
  layouts: IDashboardLayout
}

function toFiniteNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function sanitizeDashboardLayoutItem(
  value: unknown
): IDashboardLayoutItem | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const candidate = value as Record<string, unknown>

  if (typeof candidate.i !== 'string' || candidate.i === '') {
    return null
  }

  const item: IDashboardLayoutItem = {
    i: candidate.i,
    x: Math.max(0, toFiniteNumber(candidate.x, 0)),
    y: Math.max(0, toFiniteNumber(candidate.y, 0)),
    w: Math.max(1, toFiniteNumber(candidate.w, 1)),
    h: Math.max(1, toFiniteNumber(candidate.h, 1)),
    minW: Math.max(1, toFiniteNumber(candidate.minW, 1)),
    minH: Math.max(1, toFiniteNumber(candidate.minH, 1))
  }

  if (typeof candidate.maxW === 'number' && Number.isFinite(candidate.maxW)) {
    item.maxW = Math.max(item.minW, candidate.maxW)
  }

  if (typeof candidate.maxH === 'number' && Number.isFinite(candidate.maxH)) {
    item.maxH = Math.max(item.minH, candidate.maxH)
  }

  return item
}

export function sanitizeDashboardLayout(value: unknown): IDashboardLayout {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }

  const candidate = value as Record<string, unknown>
  const sanitized: IDashboardLayout = {}

  for (const [breakpoint, items] of Object.entries(candidate)) {
    if (!Array.isArray(items)) {
      continue
    }

    sanitized[breakpoint] = items
      .map(item => sanitizeDashboardLayoutItem(item))
      .filter((item): item is IDashboardLayoutItem => item !== null)
  }

  return sanitized
}

export function serializeDashboardLayout(
  layout: unknown,
  now = Date.now()
): PersistedDashboardLayout {
  return {
    version: 1,
    updatedAt: now,
    layouts: sanitizeDashboardLayout(layout)
  }
}

export function deserializeDashboardLayout(value: unknown): IDashboardLayout {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }

  const candidate = value as Record<string, unknown>

  if (
    candidate.version === 1 &&
    typeof candidate.updatedAt === 'number' &&
    'layouts' in candidate
  ) {
    return sanitizeDashboardLayout(candidate.layouts)
  }

  return sanitizeDashboardLayout(candidate)
}
