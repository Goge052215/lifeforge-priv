import { toast } from 'react-toastify'

import { useAuth, usePromiseLoading } from '@lifeforge/shared'
import type { WidgetConfig } from '@lifeforge/shared'
import { Box, Button, Card, Flex, Stack, Text } from '@lifeforge/ui'

import forgeAPI from '@/forgeAPI'

type GoogleConnection = {
  email?: string
  services?: Array<'calendar' | 'gmail' | 'drive'>
}

function IntegrationsWidget({
  dimension
}: {
  dimension: { w: number; h: number }
}) {
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

  const googleConnection = (userData?.googleConnection as GoogleConnection | null) ?? null
  const googleConnected = Boolean(userData?.googleConnected)

  async function handleLinkGoogleServices() {
    try {
      const data = await oauthAPI.getGoogleLinkEndpoint.query({
        redirectTo: '/dashboard',
        services: 'calendar,gmail,drive'
      })

      window.location.assign(data.authURL)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to link Google services.'

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

      toast.success('Google services unlinked.')
    } catch {
      toast.error('Failed to unlink Google services.')
    }
  }

  const [linkLoading, startLinkFlow] = usePromiseLoading(handleLinkGoogleServices)
  const [unlinkLoading, unlinkGoogleServices] = usePromiseLoading(
    handleUnlinkGoogleServices
  )

  const visibleServices =
    dimension.h >= 3
      ? googleConnection?.services ?? []
      : (googleConnection?.services ?? []).slice(0, 2)

  return (
    <Card gap="md" height="100%">
      <Stack gap="xs">
        <Text as="h3" size="lg" weight="semibold">
          Integrations
        </Text>
        <Text color="muted" size="sm">
          {googleConnected
            ? googleConnection?.email || 'Google connected'
            : 'Google not connected'}
        </Text>
      </Stack>

      {visibleServices.length > 0 ? (
        <Flex gap="sm" wrap="wrap">
          {visibleServices.map(service => (
            <Box
              key={service}
              bg={{ base: 'bg-200', dark: 'bg-800' }}
              p="sm"
              r="lg"
            >
              <Text size="sm" weight="medium">
                {service}
              </Text>
            </Box>
          ))}
        </Flex>
      ) : (
        <Text color="muted" size="sm">
          Link Google services to enable Calendar, Gmail, and Drive access.
        </Text>
      )}

      <Flex
        align={{ base: 'stretch', sm: 'center' }}
        direction={dimension.w <= 2 ? 'column' : 'row'}
        gap="sm"
        style={{ marginTop: 'auto' }}
      >
        <Button
          icon="tabler:link"
          loading={linkLoading}
          width={dimension.w <= 2 ? '100%' : undefined}
          onClick={startLinkFlow}
        >
          Link Google
        </Button>
        <Button
          icon="tabler:unlink"
          loading={unlinkLoading}
          variant="secondary"
          width={dimension.w <= 2 ? '100%' : undefined}
          onClick={unlinkGoogleServices}
        >
          Unlink
        </Button>
      </Flex>
    </Card>
  )
}

export default IntegrationsWidget

export const config: WidgetConfig = {
  id: 'integrations',
  icon: 'tabler:plug-connected',
  minW: 2,
  minH: 2,
  maxW: 4
}
