import { useEffect, useRef } from 'react'
import { toast } from 'react-toastify'

import { useAuth, useNavigate, useSearchParams } from '@lifeforge/shared'
import { LoadingScreen } from '@lifeforge/ui'

import forgeAPI from '@/forgeAPI'

function GoogleLinkCallbackPage() {
  const { auth, authLoading, setUserData } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const handledRef = useRef(false)

  useEffect(() => {
    if (authLoading || handledRef.current) {
      return
    }

    // #region debug-point A:callback-entry
    fetch('http://127.0.0.1:7777/event', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'google-link-hang',
        runId: 'pre-fix',
        hypothesisId: 'A',
        location: 'GoogleLinkCallbackPage.tsx:16',
        msg: '[DEBUG] google callback page effect entered',
        data: {
          auth,
          authLoading,
          href: window.location.href
        },
        ts: Date.now()
      })
    }).catch(() => {})
    // #endregion

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const fallbackRedirect = '/account-settings'

    if (!code || !state) {
      handledRef.current = true
      toast.error('Invalid Google linking attempt.')
      navigate(fallbackRedirect, { replace: true })
      return
    }

    if (!auth) {
      handledRef.current = true
      toast.error('You need an active session to link Google services.')
      navigate('/auth', { replace: true })
      return
    }

    handledRef.current = true

    // #region debug-point A:verify-start
    fetch('http://127.0.0.1:7777/event', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'google-link-hang',
        runId: 'pre-fix',
        hypothesisId: 'A',
        location: 'GoogleLinkCallbackPage.tsx:40',
        msg: '[DEBUG] starting verifyGoogleLink request',
        data: {
          hasCode: Boolean(code),
          state
        },
        ts: Date.now()
      })
    }).catch(() => {})
    // #endregion

    forgeAPI.user.oauth.verifyGoogleLink
      .mutate({
        code,
        state
      })
      .then(async data => {
        // #region debug-point A:verify-finished
        fetch('http://127.0.0.1:7777/event', {
          method: 'POST',
          body: JSON.stringify({
            sessionId: 'google-link-hang',
            runId: 'pre-fix',
            hypothesisId: 'A',
            location: 'GoogleLinkCallbackPage.tsx:46',
            msg: '[DEBUG] verifyGoogleLink request resolved',
            data: {
              redirectPath: data.redirectPath
            },
            ts: Date.now()
          })
        }).catch(() => {})
        // #endregion
        // #region debug-point D:get-userdata-start
        fetch('http://127.0.0.1:7777/event', {
          method: 'POST',
          body: JSON.stringify({
            sessionId: 'google-link-hang',
            runId: 'pre-fix',
            hypothesisId: 'D',
            location: 'GoogleLinkCallbackPage.tsx:47',
            msg: '[DEBUG] starting getUserData request after google verify',
            data: {},
            ts: Date.now()
          })
        }).catch(() => {})
        // #endregion
        const userData = await forgeAPI.user.auth.getUserData.query()
        // #region debug-point D:get-userdata-finished
        fetch('http://127.0.0.1:7777/event', {
          method: 'POST',
          body: JSON.stringify({
            sessionId: 'google-link-hang',
            runId: 'pre-fix',
            hypothesisId: 'D',
            location: 'GoogleLinkCallbackPage.tsx:50',
            msg: '[DEBUG] getUserData request resolved after google verify',
            data: {
              googleConnected: userData.googleConnected
            },
            ts: Date.now()
          })
        }).catch(() => {})
        // #endregion

        setUserData(userData)
        toast.success('Google Calendar, Gmail, and Drive are now linked.')
        navigate(data.redirectPath || fallbackRedirect, { replace: true })
      })
      .catch((error: unknown) => {
        // #region debug-point E:callback-error
        fetch('http://127.0.0.1:7777/event', {
          method: 'POST',
          body: JSON.stringify({
            sessionId: 'google-link-hang',
            runId: 'pre-fix',
            hypothesisId: 'E',
            location: 'GoogleLinkCallbackPage.tsx:61',
            msg: '[DEBUG] google callback flow failed on client',
            data: {
              error:
                error instanceof Error ? error.message : 'unknown client error'
            },
            ts: Date.now()
          })
        }).catch(() => {})
        // #endregion
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to link Google services.'

        toast.error(message)
        navigate(fallbackRedirect, { replace: true })
      })
  }, [auth, authLoading, navigate, searchParams, setUserData])

  return <LoadingScreen message="Linking Google services..." />
}

export default GoogleLinkCallbackPage
