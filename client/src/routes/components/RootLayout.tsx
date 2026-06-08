import { ErrorBoundary } from 'react-error-boundary'
import type { FallbackProps } from 'react-error-boundary'

import { Outlet } from '@lifeforge/shared'
import { ErrorScreen, Flex } from '@lifeforge/ui'

import useTitleEffect from '../hooks/useTitleEffect'
import Sidebar from './Sidebar/Sidebar'

function RootLayoutErrorFallback({ error }: FallbackProps) {
  const message =
    error instanceof Error && error.message
      ? `An unexpected error occurred: ${error.message}`
      : 'An unexpected error occurred.'

  return <ErrorScreen message={message} />
}

function RootLayout() {
  useTitleEffect()

  return (
    <>
      <Sidebar />
      <Flex
        direction="column"
        height="100%"
        minHeight="0"
        minWidth="0"
        ml={{
          base: 'none',
          sm: '3xl',
          lg: 'none'
        }}
        overflowX="hidden"
        position="relative"
        width="100%"
      >
        <ErrorBoundary FallbackComponent={RootLayoutErrorFallback}>
          <Outlet />
        </ErrorBoundary>
      </Flex>
    </>
  )
}

export default RootLayout
