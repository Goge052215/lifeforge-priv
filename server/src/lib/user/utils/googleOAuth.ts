import { encrypt2 } from '@functions/auth/encryption'
import {
  connectToPocketBase,
  validateEnvironmentVariables
} from '@functions/database/dbUtils'

const GOOGLE_AUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

const GOOGLE_SERVICE_SCOPES = {
  calendar: 'https://www.googleapis.com/auth/calendar.readonly',
  drive: 'https://www.googleapis.com/auth/drive.readonly',
  gmail: 'https://www.googleapis.com/auth/gmail.readonly'
} as const

const GOOGLE_BASE_SCOPES = ['openid', 'email', 'profile'] as const

export type GoogleService = keyof typeof GOOGLE_SERVICE_SCOPES

interface GoogleOAuthConfig {
  clientId: string
  clientSecret: string
}

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope?: string
  token_type: string
}

interface GoogleUserInfoResponse {
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
  sub?: string
}

export interface GoogleConnectionData {
  email: string
  emailVerified: boolean
  expiresAt: string
  linkedAt: string
  name: string
  picture: string
  scopes: string[]
  services: GoogleService[]
  sub: string
}

export function parseGoogleServices(rawServices?: string): GoogleService[] {
  if (!rawServices) {
    return ['calendar', 'gmail', 'drive']
  }

  const parsed = Array.from(
    new Set(
      rawServices
        .split(',')
        .map(service => service.trim().toLowerCase())
        .filter(
          (service): service is GoogleService => service in GOOGLE_SERVICE_SCOPES
        )
    )
  )

  return parsed.length > 0 ? parsed : ['calendar', 'gmail', 'drive']
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  )
}

function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.'
    )
  }

  return {
    clientId,
    clientSecret
  }
}

export function buildGoogleAuthorizationURL({
  redirectUri,
  services,
  state
}: {
  redirectUri: string
  services: GoogleService[]
  state: string
}) {
  const { clientId } = getGoogleOAuthConfig()
  const scopes = [
    ...GOOGLE_BASE_SCOPES,
    ...services.map(service => GOOGLE_SERVICE_SCOPES[service])
  ]

  const searchParams = new URLSearchParams({
    access_type: 'offline',
    client_id: clientId,
    include_granted_scopes: 'true',
    prompt: 'consent',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    state
  })

  return `${GOOGLE_AUTH_BASE_URL}?${searchParams.toString()}`
}

async function exchangeGoogleCodeForTokens({
  code,
  redirectUri
}: {
  code: string
  redirectUri: string
}): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = getGoogleOAuthConfig()

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri
  })

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  })

  if (!response.ok) {
    throw new Error('Failed to exchange Google authorization code.')
  }

  return (await response.json()) as GoogleTokenResponse
}

async function fetchGoogleUserInfo(
  accessToken: string
): Promise<GoogleUserInfoResponse> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw new Error('Failed to retrieve Google account details.')
  }

  return (await response.json()) as GoogleUserInfoResponse
}

export async function linkGoogleAccount({
  code,
  redirectUri,
  services,
  userId
}: {
  code: string
  redirectUri: string
  services: GoogleService[]
  userId: string
}): Promise<GoogleConnectionData> {
  // #region debug-point B:token-exchange-start
  fetch(process.env.DEBUG_SERVER_URL || 'http://127.0.0.1:7777/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: process.env.DEBUG_SESSION_ID || 'google-link-hang',
      runId: 'pre-fix',
      hypothesisId: 'B',
      location: 'googleOAuth.ts:183',
      msg: '[DEBUG] starting google token exchange',
      data: {
        redirectUri,
        services,
        userId
      },
      ts: Date.now()
    })
  }).catch(() => {})
  // #endregion
  const tokenResponse = await exchangeGoogleCodeForTokens({ code, redirectUri })
  // #region debug-point B:token-exchange-finished
  fetch(process.env.DEBUG_SERVER_URL || 'http://127.0.0.1:7777/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: process.env.DEBUG_SESSION_ID || 'google-link-hang',
      runId: 'pre-fix',
      hypothesisId: 'B',
      location: 'googleOAuth.ts:184',
      msg: '[DEBUG] google token exchange finished',
      data: {
        hasAccessToken: Boolean(tokenResponse.access_token),
        hasRefreshToken: Boolean(tokenResponse.refresh_token)
      },
      ts: Date.now()
    })
  }).catch(() => {})
  // #endregion
  // #region debug-point B:userinfo-start
  fetch(process.env.DEBUG_SERVER_URL || 'http://127.0.0.1:7777/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: process.env.DEBUG_SESSION_ID || 'google-link-hang',
      runId: 'pre-fix',
      hypothesisId: 'B',
      location: 'googleOAuth.ts:185',
      msg: '[DEBUG] starting google userinfo fetch',
      data: {},
      ts: Date.now()
    })
  }).catch(() => {})
  // #endregion
  const userInfo = await fetchGoogleUserInfo(tokenResponse.access_token)
  // #region debug-point B:userinfo-finished
  fetch(process.env.DEBUG_SERVER_URL || 'http://127.0.0.1:7777/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: process.env.DEBUG_SESSION_ID || 'google-link-hang',
      runId: 'pre-fix',
      hypothesisId: 'B',
      location: 'googleOAuth.ts:186',
      msg: '[DEBUG] google userinfo fetch finished',
      data: {
        email: userInfo.email,
        hasSub: Boolean(userInfo.sub)
      },
      ts: Date.now()
    })
  }).catch(() => {})
  // #endregion

  if (!userInfo.email || !userInfo.sub) {
    throw new Error('Google account details are incomplete.')
  }

  if (!tokenResponse.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. Re-consent is required.'
    )
  }

  if (!process.env.MASTER_KEY) {
    throw new Error('MASTER_KEY is required to store Google credentials.')
  }

  const connectionData: GoogleConnectionData = {
    email: userInfo.email,
    emailVerified: Boolean(userInfo.email_verified),
    expiresAt: new Date(
      Date.now() + tokenResponse.expires_in * 1000
    ).toISOString(),
    linkedAt: new Date().toISOString(),
    name: userInfo.name ?? '',
    picture: userInfo.picture ?? '',
    scopes: tokenResponse.scope?.split(' ').filter(Boolean) ?? [],
    services,
    sub: userInfo.sub
  }

  const superPBInstance = await connectToPocketBase(validateEnvironmentVariables())
  // #region debug-point C:pb-auth-finished
  fetch(process.env.DEBUG_SERVER_URL || 'http://127.0.0.1:7777/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: process.env.DEBUG_SESSION_ID || 'google-link-hang',
      runId: 'pre-fix',
      hypothesisId: 'C',
      location: 'googleOAuth.ts:214',
      msg: '[DEBUG] pocketbase superuser connection finished',
      data: {
        userId
      },
      ts: Date.now()
    })
  }).catch(() => {})
  // #endregion

  await superPBInstance.collection('users').update(userId, {
    googleConnection: connectionData,
    googleRefreshToken: encrypt2(tokenResponse.refresh_token, process.env.MASTER_KEY)
  })
  // #region debug-point C:pb-update-finished
  fetch(process.env.DEBUG_SERVER_URL || 'http://127.0.0.1:7777/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: process.env.DEBUG_SESSION_ID || 'google-link-hang',
      runId: 'pre-fix',
      hypothesisId: 'C',
      location: 'googleOAuth.ts:216',
      msg: '[DEBUG] pocketbase google connection update finished',
      data: {
        userId,
        email: connectionData.email
      },
      ts: Date.now()
    })
  }).catch(() => {})
  // #endregion

  return connectionData
}
