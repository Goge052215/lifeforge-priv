import { useEffect } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import type { FallbackProps } from 'react-error-boundary'

import { ErrorScreen, Flex, ModalProvider, Text } from '@lifeforge/ui'

import './i18n'
import Providers from './providers'

function AppErrorFallback({ error }: FallbackProps) {
  const message =
    error instanceof Error && error.message
      ? `An unexpected error occurred: ${error.message}`
      : 'An unexpected error occurred.'

  return <ErrorScreen message={message} />
}

// @ts-expect-error - VITE_API_HOST is injected at build time
window.VITE_API_HOST = import.meta.env.VITE_API_HOST

function App() {
  useEffect(() => {
    const preloader = document.querySelector('.preloader')

    if (preloader) {
      preloader.remove()
    }
  }, [])

  return (
    <ErrorBoundary FallbackComponent={AppErrorFallback}>
      <Text
        asChild
        color={{
          base: 'bg-800',
          dark: 'bg-100'
        }}
      >
        <Flex as="main" height="100dvh" id="app" overflow="hidden" width="100%">
          <ModalProvider>
            <Providers />
          </ModalProvider>
        </Flex>
      </Text>
    </ErrorBoundary>
  )
}

export default App
