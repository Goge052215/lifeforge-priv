import type { ModuleCategory } from '@lifeforge/shared'

import accountSettings from '@/core/accountSettings/manifest'
import apiKeys from '@/core/apiKeys/manifest'
import backups from '@/core/backups/manifest'
import calendar from '@/core/calendar/manifest'
import dashboard from '@/core/dashboard/manifest'
import documentation from '@/core/documentation/manifest'
import integrations from '@/core/integrations/manifest'
import moduleManager from '@/core/moduleManager/manifest'
import personalization from '@/core/personalization/manifest'

export default function loadCoreModules(): ModuleCategory['items'][number][] {
  return [
    accountSettings,
    apiKeys,
    backups,
    calendar,
    dashboard,
    documentation,
    integrations,
    personalization,
    moduleManager
  ]
}
