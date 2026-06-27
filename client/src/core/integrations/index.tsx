import dayjs from 'dayjs'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'

import {
  type IDashboardLayout,
  useAuth,
  usePersonalization,
  usePromiseLoading
} from '@lifeforge/shared'
import {
  Button,
  ContextMenuItem,
  Flex,
  ModuleHeader,
  OptionsColumn,
  Stack,
  Text
} from '@lifeforge/ui'

import EditableLayoutSaveBar from '@/core/common/editableLayout/EditableLayoutSaveBar'
import EditableModuleGrid from '@/core/common/editableLayout/EditableModuleGrid'
import forgeAPI from '@/forgeAPI'
import { useUserPersonalization } from '@/providers/features/UserPersonalizationProvider'

const DEFAULT_INTEGRATIONS_LAYOUT: IDashboardLayout = {
  lg: [
    { i: 'google-services', x: 0, y: 0, w: 5, h: 3, minW: 3, minH: 3 },
    { i: 'service-access', x: 5, y: 0, w: 3, h: 3, minW: 2, minH: 3 },
    { i: 'connection-summary', x: 0, y: 3, w: 8, h: 2, minW: 3, minH: 2 }
  ],
  md: [
    { i: 'google-services', x: 0, y: 0, w: 5, h: 3, minW: 3, minH: 3 },
    { i: 'service-access', x: 5, y: 0, w: 3, h: 3, minW: 2, minH: 3 },
    { i: 'connection-summary', x: 0, y: 3, w: 8, h: 2, minW: 3, minH: 2 }
  ],
  sm: [
    { i: 'google-services', x: 0, y: 0, w: 4, h: 3, minW: 2, minH: 3 },
    { i: 'service-access', x: 0, y: 3, w: 4, h: 3, minW: 2, minH: 3 },
    { i: 'connection-summary', x: 0, y: 6, w: 4, h: 2, minW: 2, minH: 2 }
  ],
  xs: [
    { i: 'google-services', x: 0, y: 0, w: 4, h: 3, minW: 2, minH: 3 },
    { i: 'service-access', x: 0, y: 3, w: 4, h: 3, minW: 2, minH: 3 },
    { i: 'connection-summary', x: 0, y: 6, w: 4, h: 2, minW: 2, minH: 2 }
  ],
  xxs: [
    { i: 'google-services', x: 0, y: 0, w: 4, h: 3, minW: 2, minH: 3 },
    { i: 'service-access', x: 0, y: 3, w: 4, h: 3, minW: 2, minH: 3 },
    { i: 'connection-summary', x: 0, y: 6, w: 4, h: 2, minW: 2, minH: 2 }
  ]
}

type GoogleConnection = {
  email?: string
  expiresAt?: string
  linkedAt?: string
  name?: string
  scopes?: string[]
  services?: Array<'calendar' | 'gmail' | 'drive'>
}

function hasLayout(layout: IDashboardLayout) {
  return Object.values(layout).some(items => items.length > 0)
}

function GoogleServicesTile({
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
        redirectTo: '/integrations',
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

  return (
    <OptionsColumn
      breakpoint={false}
      description="Connect your Google workspace services"
      height="100%"
      icon="tabler:brand-google"
      orientation="vertical"
      title="Google Services"
    >
      <Stack gap="md" width="100%">
        <Text as="p" color="muted">
          {googleConnected
            ? googleConnection?.email || 'Connected'
            : 'Not connected'}
        </Text>
        <Flex
          align={{ base: 'stretch', md: 'center' }}
          direction={dimension.w <= 3 ? 'column' : 'row'}
          gap="sm"
          width="100%"
        >
          <Button
            icon="tabler:link"
            loading={linkLoading}
            width={{ base: '100%', md: 'auto' }}
            onClick={startLinkFlow}
          >
            Link Google
          </Button>
          <Button
            icon="tabler:unlink"
            loading={unlinkLoading}
            variant="secondary"
            width={{ base: '100%', md: 'auto' }}
            onClick={unlinkGoogleServices}
          >
            Unlink
          </Button>
        </Flex>
      </Stack>
    </OptionsColumn>
  )
}

function ServiceAccessTile({
  dimension
}: {
  dimension: { w: number; h: number }
}) {
  const { userData } = useAuth()
  const googleConnection = (userData?.googleConnection as GoogleConnection | null) ?? null
  const connectedServices = new Set(googleConnection?.services ?? [])

  return (
    <OptionsColumn
      breakpoint={false}
      description="Available linked capabilities"
      height="100%"
      icon="tabler:apps"
      orientation="vertical"
      title="Service Access"
    >
      <Stack gap="sm" width="100%">
        {[
          { id: 'calendar', label: 'Calendar sync' },
          { id: 'gmail', label: 'Gmail actions' },
          { id: 'drive', label: 'Drive access' }
        ].map(service => (
          <Flex
            key={service.id}
            align="center"
            bg={
              connectedServices.has(service.id as 'calendar' | 'gmail' | 'drive')
                ? { base: 'bg-200', dark: 'bg-800' }
                : undefined
            }
            justify="between"
            p="sm"
            r="lg"
          >
            <Text weight="medium">{service.label}</Text>
            <Text color="muted">
              {connectedServices.has(service.id as 'calendar' | 'gmail' | 'drive')
                ? 'Enabled'
                : dimension.h >= 3
                  ? 'Link Google to enable'
                  : 'Disabled'}
            </Text>
          </Flex>
        ))}
      </Stack>
    </OptionsColumn>
  )
}

function ConnectionSummaryTile({
  dimension
}: {
  dimension: { w: number; h: number }
}) {
  const { userData } = useAuth()
  const googleConnection = (userData?.googleConnection as GoogleConnection | null) ?? null

  const summary = useMemo(
    () => [
      {
        label: 'Account',
        value: googleConnection?.email || 'No linked account'
      },
      {
        label: 'Connected since',
        value: googleConnection?.linkedAt
          ? dayjs(googleConnection.linkedAt).format('MMM D, YYYY h:mm A')
          : 'Not linked'
      },
      {
        label: 'Token expiry',
        value: googleConnection?.expiresAt
          ? dayjs(googleConnection.expiresAt).format('MMM D, YYYY h:mm A')
          : 'Unknown'
      },
      {
        label: 'Granted scopes',
        value: String(googleConnection?.scopes?.length ?? 0)
      }
    ],
    [googleConnection]
  )

  return (
    <OptionsColumn
      breakpoint={false}
      description="Connection metadata"
      height="100%"
      icon="tabler:info-circle"
      orientation="vertical"
      title="Summary"
    >
      <Stack gap="sm" width="100%">
        {summary.slice(0, dimension.h >= 3 ? summary.length : 3).map(item => (
          <Flex key={item.label} align="center" justify="between" gap="md">
            <Text color="muted">{item.label}</Text>
            <Text align="right" weight="medium">
              {item.value}
            </Text>
          </Flex>
        ))}
      </Stack>
    </OptionsColumn>
  )
}

function Integrations() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [canLayoutChange, setCanLayoutChange] = useState(false)
  const { integrationsLayout } = usePersonalization() as {
    integrationsLayout: IDashboardLayout
  }
  const { changeIntegrationsLayout } = useUserPersonalization()

  const effectiveLayout = hasLayout(integrationsLayout)
    ? integrationsLayout
    : DEFAULT_INTEGRATIONS_LAYOUT

  return (
    <Flex ref={wrapperRef} direction="column" flex="1" mb="2xl">
      <ModuleHeader
        contextMenuProps={{
          children: (
            <ContextMenuItem
              icon="tabler:pencil"
              label="Edit Layout"
              onClick={() => {
                setCanLayoutChange(current => !current)
              }}
            />
          )
        }}
      />
      <EditableModuleGrid
        canLayoutChange={canLayoutChange}
        items={[
          { id: 'google-services', component: GoogleServicesTile },
          { id: 'service-access', component: ServiceAccessTile },
          { id: 'connection-summary', component: ConnectionSummaryTile }
        ]}
        layout={effectiveLayout}
        wrapperRef={wrapperRef}
        onLayoutChange={changeIntegrationsLayout}
      />
      <EditableLayoutSaveBar
        canChange={canLayoutChange}
        label="You are editing integrations layout"
        setCanChange={setCanLayoutChange}
      />
    </Flex>
  )
}

export default Integrations
