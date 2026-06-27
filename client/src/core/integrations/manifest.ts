import { lazy } from 'react'

import type { ModuleCategory } from '@lifeforge/shared'

export default {
  routes: {
    '/': lazy(() => import('./index'))
  },
  name: 'integrations',
  displayName: 'Integrations',
  version: '1.0.0',
  author: 'LifeForge <https://lifeforge.dev>',
  description: 'Integrations',
  icon: 'tabler:plug-connected',
  category: '<START>',
  APIKeyAccess: {}
} satisfies ModuleCategory['items'][number]
