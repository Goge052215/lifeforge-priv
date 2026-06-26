import dayjs from 'dayjs'
import { v4 } from 'uuid'

import type { GoogleService } from './googleOAuth'

interface PendingAuthSession {
  token: string
  email: string
  userId: string
  expiresAt: string
  otpId?: string
}

interface PendingOAuthState {
  kind: 'login' | 'google-link'
  codeVerifier?: string
  provider?: string
  redirectPath?: string
  services?: GoogleService[]
  userId?: string
  expiresAt: string
}

interface PendingTwoFASetupState {
  challenge: string
  tempCode?: string
  expiresAt: string
}

const pendingAuthSessions = new Map<string, PendingAuthSession>()
const pendingOAuthStates = new Map<string, PendingOAuthState>()
const pendingTwoFASetups = new Map<string, PendingTwoFASetupState>()

const AUTH_FLOW_TTL_MS = 5 * 60 * 1000

function isExpired(expiresAt: string) {
  return dayjs().isAfter(dayjs(expiresAt))
}

function cleanupExpiredEntries() {
  for (const [tid, session] of pendingAuthSessions) {
    if (isExpired(session.expiresAt)) {
      pendingAuthSessions.delete(tid)
    }
  }

  for (const [state, session] of pendingOAuthStates) {
    if (isExpired(session.expiresAt)) {
      pendingOAuthStates.delete(state)
    }
  }

  for (const [userId, session] of pendingTwoFASetups) {
    if (isExpired(session.expiresAt)) {
      pendingTwoFASetups.delete(userId)
    }
  }
}

const cleanupTimer = setInterval(cleanupExpiredEntries, 60 * 1000)
cleanupTimer.unref?.()

function newExpiry() {
  return dayjs().add(AUTH_FLOW_TTL_MS, 'millisecond').toISOString()
}

export function createPendingAuthSession({
  token,
  email,
  userId
}: {
  token: string
  email: string
  userId: string
}) {
  const tid = v4()

  pendingAuthSessions.set(tid, {
    token,
    email,
    userId,
    expiresAt: newExpiry()
  })

  return tid
}

export function getPendingAuthSession(tid: string) {
  cleanupExpiredEntries()

  const session = pendingAuthSessions.get(tid)

  if (!session || isExpired(session.expiresAt)) {
    pendingAuthSessions.delete(tid)
    return null
  }

  return session
}

export function setPendingAuthSessionOTP(tid: string, otpId: string) {
  const session = getPendingAuthSession(tid)

  if (!session) {
    return false
  }

  pendingAuthSessions.set(tid, {
    ...session,
    otpId,
    expiresAt: newExpiry()
  })

  return true
}

export function consumePendingAuthSession(tid: string) {
  const session = getPendingAuthSession(tid)

  if (!session) {
    return null
  }

  pendingAuthSessions.delete(tid)
  return session
}

export function createPendingOAuthState(
  state: string,
  data: Omit<PendingOAuthState, 'expiresAt'>
) {
  pendingOAuthStates.set(state, {
    ...data,
    expiresAt: newExpiry()
  })
}

export function consumePendingOAuthState(state: string) {
  cleanupExpiredEntries()

  const session = pendingOAuthStates.get(state)

  if (!session || isExpired(session.expiresAt)) {
    pendingOAuthStates.delete(state)
    return null
  }

  pendingOAuthStates.delete(state)
  return session
}

export function getOrCreateTwoFASetupState(userId: string) {
  cleanupExpiredEntries()

  const existing = pendingTwoFASetups.get(userId)

  if (existing && !isExpired(existing.expiresAt)) {
    return existing
  }

  const nextState: PendingTwoFASetupState = {
    challenge: v4(),
    expiresAt: newExpiry()
  }

  pendingTwoFASetups.set(userId, nextState)
  return nextState
}

export function setTwoFASetupTempCode(userId: string, tempCode: string) {
  const current = getOrCreateTwoFASetupState(userId)

  pendingTwoFASetups.set(userId, {
    ...current,
    tempCode,
    expiresAt: newExpiry()
  })
}

export function getTwoFASetupState(userId: string) {
  cleanupExpiredEntries()

  const state = pendingTwoFASetups.get(userId)

  if (!state || isExpired(state.expiresAt)) {
    pendingTwoFASetups.delete(userId)
    return null
  }

  return state
}

export function clearTwoFASetupState(userId: string) {
  pendingTwoFASetups.delete(userId)
}
