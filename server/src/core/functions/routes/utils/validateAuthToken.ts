import { PBService } from '@functions/database'
import { Request, Response } from 'express'
import Pocketbase from 'pocketbase'

export default async function isAuthTokenValid(
  req: Request<unknown, unknown, unknown, unknown>,
  res: Response,
  noAuth: boolean
): Promise<boolean> {
  const bearerToken = req.headers.authorization?.split(' ')[1]
  // #region debug-point A:auth-gate-entry
  fetch(process.env.DEBUG_SERVER_URL || 'http://127.0.0.1:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: process.env.DEBUG_SESSION_ID || 'railway-auth-500', runId: 'pre-fix', hypothesisId: 'A', location: 'validateAuthToken.ts:10', msg: '[DEBUG] auth gate entry', data: { url: req.url, noAuth, hasBearerToken: Boolean(bearerToken) }, ts: Date.now() }) }).catch(() => {})
  // #endregion

  const pb = new Pocketbase(process.env.PB_HOST)

  if (!bearerToken || req.url.startsWith('/user/auth')) {
    if (req.url === '/' || noAuth) {
      req.pb = (module: { id: string }) => new PBService(pb, module)

      return true
    }
  }

  if (!bearerToken) {
    // #region debug-point A:auth-gate-no-token
    fetch(process.env.DEBUG_SERVER_URL || 'http://127.0.0.1:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: process.env.DEBUG_SESSION_ID || 'railway-auth-500', runId: 'pre-fix', hypothesisId: 'A', location: 'validateAuthToken.ts:23', msg: '[DEBUG] auth gate rejected request without bearer token', data: { url: req.url, noAuth }, ts: Date.now() }) }).catch(() => {})
    // #endregion
    res.status(401).send({
      state: 'error',
      message: 'Authorization token is required'
    })

    return false
  }

  try {
    pb.authStore.save(bearerToken, null)

    try {
      await pb.collection('users').authRefresh()
    } catch (error: any) {
      if (error.response.code === 401) {
        // #region debug-point A:auth-refresh-401
        fetch(process.env.DEBUG_SERVER_URL || 'http://127.0.0.1:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: process.env.DEBUG_SESSION_ID || 'railway-auth-500', runId: 'pre-fix', hypothesisId: 'A', location: 'validateAuthToken.ts:38', msg: '[DEBUG] auth refresh returned 401', data: { url: req.url }, ts: Date.now() }) }).catch(() => {})
        // #endregion
        res.status(401).send({
          state: 'error',
          message: 'Invalid authorization credentials'
        })

        return false
      }
    }

    req.pb = (module: { id: string }) => new PBService(pb, module)
    // #region debug-point A:auth-gate-success
    fetch(process.env.DEBUG_SERVER_URL || 'http://127.0.0.1:7777/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: process.env.DEBUG_SESSION_ID || 'railway-auth-500', runId: 'pre-fix', hypothesisId: 'A', location: 'validateAuthToken.ts:50', msg: '[DEBUG] auth gate success', data: { url: req.url, hasRecord: Boolean(pb.authStore.record?.id) }, ts: Date.now() }) }).catch(() => {})
    // #endregion

    return true
  } catch {
    res.status(500).send({
      state: 'error',
      message: 'Internal server error'
    })

    return false
  }
}
