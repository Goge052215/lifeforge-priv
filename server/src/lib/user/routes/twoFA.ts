import { decrypt2, encrypt, encrypt2 } from '@functions/auth/encryption'
import dayjs from 'dayjs'
import PocketBase from 'pocketbase'
import speakeasy from 'speakeasy'
import z from 'zod'

import forge from '../forge'
import { removeSensitiveData, updateNullData } from '../utils/auth'
import {
  clearTwoFASetupState,
  consumePendingAuthSession,
  getOrCreateTwoFASetupState,
  getPendingAuthSession,
  getTwoFASetupState,
  setPendingAuthSessionOTP,
  setTwoFASetupTempCode
} from '../utils/authFlowState'
import { verifyAppOTP, verifyEmailOTP } from '../utils/otp'

export const getChallenge = forge
  .query({
    description: 'Retrieve 2FA challenge token',
    input: {},
    output: {
      OK: z.string()
    }
  })
  .callback(async ({ pb, response }) =>
    response.ok(getOrCreateTwoFASetupState(pb.instance.authStore.record!.id).challenge)
  )

export const requestOTP = forge
  .query({
    description: 'Request OTP for two-factor authentication',
    noAuth: true,
    input: {
      query: z.object({
        tid: z.string(),
        email: z.string().email()
      })
    },
    output: {
      OK: z.string(),
      BAD_REQUEST: z.string()
    }
  })
  .callback(async ({ pb, query: { tid, email }, response }) => {
    const pendingSession = getPendingAuthSession(tid)

    if (!pendingSession || pendingSession.email !== email) {
      return response.badRequest('Failed to request OTP')
    }

    const otp = await pb.instance
      .collection('users')
      .requestOTP(pendingSession.email)
      .catch(() => null)

    if (!otp) {
      return response.badRequest('Failed to request OTP')
    }

    if (!setPendingAuthSessionOTP(tid, otp.otpId)) {
      return response.badRequest('Failed to request OTP')
    }

    return response.ok(tid)
  })

export const generateAuthenticatorLink = forge
  .query({
    description: 'Generate authenticator app setup link',
    input: {},
    output: {
      OK: z.string()
    }
  })
  .callback(
    async ({
      pb,
      req: {
        headers: { authorization }
      },
      response
    }) => {
      const { email } = pb.instance.authStore.record!
      const userId = pb.instance.authStore.record!.id
      const setupState = getOrCreateTwoFASetupState(userId)
      const challenge = setupState.challenge

      const tempCode = speakeasy.generateSecret({
        name: email,
        length: 32,
        issuer: 'LifeForge.'
      }).base32

      setTwoFASetupTempCode(userId, tempCode)

      return response.ok(
        encrypt2(
          encrypt2(
            `otpauth://totp/${email}?secret=${tempCode}&issuer=LifeForge.`,
            challenge
          ),
          authorization!.replace('Bearer ', '')
        )
      )
    }
  )

export const verifyAndEnable = forge
  .mutation({
    description: 'Verify and activate two-factor authentication',
    input: {
      body: z.object({
        otp: z.string()
      })
    },
    output: {
      NO_CONTENT: true,
      UNAUTHORIZED: true
    }
  })
  .callback(
    async ({
      pb,
      body: { otp },
      req: {
        headers: { authorization }
      },
      response
    }) => {
      const userId = pb.instance.authStore.record!.id
      const setupState = getTwoFASetupState(userId)

      if (!setupState?.tempCode) {
        return response.unauthorized()
      }

      const decryptedOTP = decrypt2(
        decrypt2(otp, authorization!.replace('Bearer ', '')),
        setupState.challenge
      )

      const verified = speakeasy.totp.verify({
        secret: setupState.tempCode,
        encoding: 'base32',
        token: decryptedOTP
      })

      if (!verified) {
        return response.unauthorized()
      }

      await pb.update
        .collection('users')
        .id(pb.instance.authStore.record!.id)
        .data({
          twoFASecret: encrypt(
            Buffer.from(setupState.tempCode),
            process.env.MASTER_KEY!
          ).toString('base64')
        })
        .execute()

      clearTwoFASetupState(userId)

      return response.noContent()
    }
  )

export const disable = forge
  .mutation({
    description: 'Disable two-factor authentication',
    input: {},
    output: {
      NO_CONTENT: true
    }
  })
  .callback(async ({ pb, response }) => {
    await pb.update
      .collection('users')
      .id(pb.instance.authStore.record!.id)
      .data({
        twoFASecret: ''
      })
      .execute()

    return response.noContent()
  })

export const verify = forge
  .mutation({
    description: 'Verify two-factor authentication code',
    noAuth: true,
    input: {
      body: z.object({
        otp: z.string(),
        tid: z.string(),
        type: z.enum(['email', 'app'])
      })
    },
    output: {
      OK: z.object({
        session: z.string()
      }),
      UNAUTHORIZED: true
    }
  })
  .callback(async ({ body: { otp, tid, type }, response }) => {
    const pendingSession = getPendingAuthSession(tid)

    if (!pendingSession || dayjs().isAfter(dayjs(pendingSession.expiresAt))) {
      return response.unauthorized()
    }

    const pb = new PocketBase(process.env.PB_HOST)

    pb.authStore.save(pendingSession.token, null)
    await pb
      .collection('users')
      .authRefresh()
      .catch(() => {})

    if (!pb.authStore.isValid || !pb.authStore.record) {
      return response.unauthorized()
    }

    let verified = false

    if (type === 'app') {
      verified = await verifyAppOTP(pb, otp)
    } else if (type === 'email') {
      verified = await verifyEmailOTP(pb, tid, otp)
    }

    if (!verified) {
      return response.unauthorized()
    }

    const userData = pb.authStore.record

    const sanitizedUserData = removeSensitiveData(userData)

    await updateNullData(sanitizedUserData, pb)
    consumePendingAuthSession(tid)

    return response.ok({
      session: pb.authStore.token
    })
  })
