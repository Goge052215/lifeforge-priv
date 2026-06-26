import z from 'zod'

import forge from '../forge'
import {
  consumePendingOAuthState,
  createPendingAuthSession,
  createPendingOAuthState
} from '../utils/authFlowState'
import {
  buildGoogleAuthorizationURL,
  type GoogleService,
  isGoogleOAuthConfigured,
  linkGoogleAccount,
  parseGoogleServices
} from '../utils/googleOAuth'

const googleConnectionSchema = z.object({
  email: z.string().email(),
  emailVerified: z.boolean(),
  expiresAt: z.string(),
  linkedAt: z.string(),
  name: z.string(),
  picture: z.string(),
  scopes: z.array(z.string()),
  services: z.array(z.enum(['calendar', 'gmail', 'drive'])),
  sub: z.string()
})

export const listProviders = forge
  .query({
    description: 'Retrieve available OAuth providers',
    noAuth: true,
    encrypted: false,
    input: {},
    output: {
      OK: z.array(z.string())
    }
  })
  .callback(async ({ pb, response }) => {
    return response.ok(
      (
        await pb.instance.collection('users').listAuthMethods()
      ).oauth2.providers.map(e => e.name)
    )
  })

export const getEndpoint = forge
  .query({
    description: 'Get OAuth authorization URL for provider',
    noAuth: true,
    encrypted: false,
    input: {
      query: z.object({
        provider: z.string()
      })
    },
    output: {
      OK: z.object({
        name: z.string(),
        state: z.string(),
        codeVerifier: z.string(),
        codeChallenge: z.string(),
        codeChallengeMethod: z.string(),
        authURL: z.string(),
        displayName: z.string()
      }),
      BAD_REQUEST: z.string()
    }
  })
  .callback(async ({ pb, query: { provider }, response }) => {
    const oauthEndpoints = await pb.instance
      .collection('users')
      .listAuthMethods()

    const endpoint = oauthEndpoints.oauth2.providers.find(
      item => item.name === provider
    )

    if (!endpoint) {
      return response.badRequest('Invalid provider')
    }

    createPendingOAuthState(endpoint.state, {
      kind: 'login',
      codeVerifier: endpoint.codeVerifier,
      provider
    })

    return response.ok(endpoint)
  })

export const verify = forge
  .mutation({
    description: 'Verify OAuth authorization callback',
    noAuth: true,
    input: {
      body: z.object({
        provider: z.string(),
        code: z.string(),
        state: z.string()
      })
    },
    output: {
      OK: z.union([
        z.object({
          state: z.literal('2fa_required'),
          tid: z.string()
        }),
        z.string()
      ]),
      UNAUTHORIZED: true,
      BAD_REQUEST: z.string()
    }
  })
  .callback(
    async ({
      req,
      pb,
      body: { provider: providerName, code, state },
      response
    }) => {
      const providers = await pb.instance.collection('users').listAuthMethods()

      const provider = providers.oauth2.providers.find(
        item => item.name === providerName
      )

      const pendingOAuthState = consumePendingOAuthState(state)

      if (
        !provider ||
        !pendingOAuthState ||
        pendingOAuthState.kind !== 'login' ||
        !pendingOAuthState.codeVerifier
      ) {
        return response.badRequest('Invalid login attempt')
      }

      try {
        const authData = await pb.instance
          .collection('users')
          .authWithOAuth2Code(
            provider.name,
            code,
            pendingOAuthState.codeVerifier,
            `${req.headers.origin}/auth`,
            {
              emailVisibility: false
            }
          )

        if (authData) {
          if (pb.instance.authStore.record?.twoFASecret) {
            const tid = createPendingAuthSession({
              token: pb.instance.authStore.token,
              email: pb.instance.authStore.record.email,
              userId: pb.instance.authStore.record.id
            })

            return response.ok({
              state: '2fa_required',
              tid
            })
          }

          return response.ok(pb.instance.authStore.token)
        } else {
          return response.unauthorized()
        }
      } catch {
        return response.unauthorized()
      }
    }
  )

export const getGoogleLinkEndpoint = forge
  .query({
    description:
      'Get Google authorization URL for linking Calendar, Gmail, and Drive',
    encrypted: false,
    input: {
      query: z.object({
        services: z.string().optional(),
        redirectTo: z.string().optional()
      })
    },
    output: {
      OK: z.object({
        authURL: z.string(),
        enabled: z.boolean(),
        services: z.array(z.enum(['calendar', 'gmail', 'drive'])),
        state: z.string()
      }),
      BAD_REQUEST: z.string()
    }
  })
  .callback(async ({ pb, req, query: { services, redirectTo }, response }) => {
    if (!isGoogleOAuthConfigured()) {
      return response.badRequest(
        'Google OAuth is not configured on the server.'
      )
    }

    const userId = pb.instance.authStore.record?.id

    if (!userId) {
      return response.badRequest('You must be signed in to link Google.')
    }

    const googleServices = parseGoogleServices(services)
    const state = crypto.randomUUID()
    const redirectPath = redirectTo?.trim() || '/account-settings'
    const redirectUri = new URL('/oauth/google/callback', req.headers.origin)

    redirectUri.searchParams.set('redirect', redirectPath)

    createPendingOAuthState(state, {
      kind: 'google-link',
      redirectPath,
      services: googleServices,
      userId
    })

    return response.ok({
      authURL: buildGoogleAuthorizationURL({
        redirectUri: redirectUri.toString(),
        services: googleServices,
        state
      }),
      enabled: true,
      services: googleServices,
      state
    })
  })

export const verifyGoogleLink = forge
  .mutation({
    description:
      'Verify Google authorization callback and link Calendar, Gmail, and Drive',
    noAuth: true,
    input: {
      body: z.object({
        code: z.string(),
        state: z.string()
      })
    },
    output: {
      OK: z.object({
        googleConnection: googleConnectionSchema
      }),
      BAD_REQUEST: z.string(),
      UNAUTHORIZED: true
    }
  })
  .callback(async ({ req, body: { code, state }, response }) => {
    const pendingOAuthState = consumePendingOAuthState(state)
    const defaultGoogleServices: GoogleService[] = [
      'calendar',
      'gmail',
      'drive'
    ]

    if (
      !pendingOAuthState ||
      pendingOAuthState.kind !== 'google-link' ||
      !pendingOAuthState.userId
    ) {
      return response.badRequest('Invalid Google linking attempt.')
    }

    try {
      const redirectUri = new URL('/oauth/google/callback', req.headers.origin)

      if (pendingOAuthState.redirectPath) {
        redirectUri.searchParams.set('redirect', pendingOAuthState.redirectPath)
      }

      const googleConnection = await linkGoogleAccount({
        code,
        redirectUri: redirectUri.toString(),
        services: pendingOAuthState.services ?? defaultGoogleServices,
        userId: pendingOAuthState.userId
      })

      return response.ok({
        googleConnection
      })
    } catch (error) {
      return response.badRequest(
        error instanceof Error
          ? error.message
          : 'Failed to link Google account.'
      )
    }
  })

export const unlinkGoogleLink = forge
  .mutation({
    description: 'Disconnect the linked Google account',
    input: {},
    output: {
      NO_CONTENT: true
    }
  })
  .callback(async ({ pb, response }) => {
    const userId = pb.instance.authStore.record?.id

    if (!userId) {
      return response.noContent()
    }

    await pb.update
      .collection('users')
      .id(userId)
      .data({
        googleConnection: null,
        googleRefreshToken: ''
      })
      .execute()

    return response.noContent()
  })
