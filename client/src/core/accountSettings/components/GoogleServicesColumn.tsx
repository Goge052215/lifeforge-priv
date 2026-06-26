import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { useAuth, usePromiseLoading } from '@lifeforge/shared'
import { Button, Flex, OptionsColumn, Text } from '@lifeforge/ui'

import forgeAPI from '@/forgeAPI'

function GoogleServicesColumn() {
  const { t } = useTranslation('common.accountSettings')
  const { setUserData, userData } = useAuth()
  const oauthAPI = forgeAPI.user.oauth as typeof forgeAPI.user.oauth & {
    getGoogleLinkEndpoint: {
      query: (input: {
        redirectTo: string
        services: string
      }) => Promise<{ authURL: string }>
    }
    unlinkGoogleLink: {
      mutate: (input: undefined) => Promise<void>
    }
  }

  if (!userData) {
    return null
  }

  const googleConnection = userData.googleConnection as
    | {
        email?: string
      }
    | null
    | undefined

  const googleConnected = Boolean(userData.googleConnected)

  async function handleLinkGoogleServices() {
    try {
      const data = await oauthAPI.getGoogleLinkEndpoint.query({
        redirectTo: '/account-settings',
        services: 'calendar,gmail,drive'
      })

      window.location.assign(data.authURL)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('messages.googleLinkFailed')

      toast.error(message)
    }
  }

  async function handleUnlinkGoogleServices() {
    try {
      await oauthAPI.unlinkGoogleLink.mutate(undefined)

      setUserData(currentUserData =>
        currentUserData
          ? {
              ...currentUserData,
              googleConnected: false,
              googleConnection: null
            }
          : null
      )

      toast.success(t('messages.googleUnlinked'))
    } catch {
      toast.error(t('messages.googleUnlinkFailed'))
    }
  }

  const [linkLoading, startLinkFlow] = usePromiseLoading(
    handleLinkGoogleServices
  )
  const [unlinkLoading, unlinkGoogleServices] = usePromiseLoading(
    handleUnlinkGoogleServices
  )

  return (
    <OptionsColumn
      description={t('settings.desc.googleServices')}
      icon="tabler:brand-google"
      title={t('settings.title.googleServices')}
    >
      <Flex
        align={{ base: 'stretch', md: 'center' }}
        direction={{ base: 'column', md: 'row' }}
        gap="sm"
        justify="end"
        width="100%"
      >
        <Text color="muted">
          {googleConnected
            ? googleConnection?.email || t('misc.connected')
            : t('misc.disconnected')}
        </Text>
        <Button
          icon="tabler:link"
          loading={linkLoading}
          namespace="common.accountSettings"
          width={{ base: '100%', md: 'auto' }}
          onClick={startLinkFlow}
        >
          linkGoogle
        </Button>
        <Button
          icon="tabler:unlink"
          loading={unlinkLoading}
          namespace="common.accountSettings"
          variant="secondary"
          width={{ base: '100%', md: 'auto' }}
          onClick={unlinkGoogleServices}
        >
          unlinkGoogle
        </Button>
      </Flex>
    </OptionsColumn>
  )
}

export default GoogleServicesColumn
