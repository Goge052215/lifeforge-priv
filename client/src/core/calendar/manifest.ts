import { lazy } from 'react'

import type { ModuleCategory } from '@lifeforge/shared'

export default {
  routes: {
    '/': lazy(() => import('./index'))
  },
  name: 'calendar',
  displayName: 'Calendar',
  version: '1.0.0',
  author: 'LifeForge <https://lifeforge.dev>',
  description: 'Calendar',
  icon: 'tabler:calendar-month',
  category: '<START>',
  APIKeyAccess: {}
} satisfies ModuleCategory['items'][number]
