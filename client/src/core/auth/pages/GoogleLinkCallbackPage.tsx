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

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const redirectTo = searchParams.get('redirect') || '/account-settings'

    if (!code || !state) {
      handledRef.current = true
      toast.error('Invalid Google linking attempt.')
      navigate(redirectTo, { replace: true })
      return
    }

    if (!auth) {
      handledRef.current = true
      toast.error('You need an active session to link Google services.')
      navigate('/auth', { replace: true })
      return
    }

    handledRef.current = true

    forgeAPI.user.oauth.verifyGoogleLink
      .mutate({
        code,
        state
      })
      .then(async () => {
        const userData = await forgeAPI.user.auth.getUserData.query()

        setUserData(userData)
        toast.success('Google Calendar, Gmail, and Drive are now linked.')
        navigate(redirectTo, { replace: true })
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to link Google services.'

        toast.error(message)
        navigate(redirectTo, { replace: true })
      })
  }, [auth, authLoading, navigate, searchParams, setUserData])

  return <LoadingScreen message="Linking Google services..." />
}

export default GoogleLinkCallbackPage
