import { useEffect, useRef } from 'react'
import { toast } from 'react-toastify'

import { useAuth, useSearchParams } from '@lifeforge/shared'
import { LoadingScreen } from '@lifeforge/ui'

import forgeAPI from '@/forgeAPI'

function GoogleLinkCallbackPage() {
  const { auth, authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const handledRef = useRef(false)

  useEffect(() => {
    if (authLoading || handledRef.current) {
      return
    }

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const fallbackRedirect = '/account-settings'

    if (!code || !state) {
      handledRef.current = true
      toast.error('Invalid Google linking attempt.')
      window.location.replace(fallbackRedirect)
      return
    }

    if (!auth) {
      handledRef.current = true
      toast.error('You need an active session to link Google services.')
      window.location.replace('/auth')
      return
    }

    handledRef.current = true

    forgeAPI.user.oauth.verifyGoogleLink
      .mutate({
        code,
        state
      })
      .then(data => {
        toast.success('Google Calendar, Gmail, and Drive are now linked.')
        window.location.replace(data.redirectPath || fallbackRedirect)
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to link Google services.'

        toast.error(message)
        window.location.replace(fallbackRedirect)
      })
  }, [auth, authLoading, searchParams])

  return <LoadingScreen message="Linking Google services..." />
}

export default GoogleLinkCallbackPage
