import { ROOT_DIR } from '@constants'
import { decrypt2 } from '@functions/auth/encryption'
import { createServiceLogger } from '@functions/logging'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'

import { IPBService } from '@lifeforge/server-utils'

import { connectToPocketBase, validateEnvironmentVariables } from './dbUtils'
import PBService from './PBService'

const logger = createServiceLogger('API Key Vault')
let privilegedAPIKeysPBPromise: Promise<PBService<any>> | null = null

export async function getAPIKeysPBService(): Promise<PBService<{ entries: any }>> {
  if (!privilegedAPIKeysPBPromise) {
    privilegedAPIKeysPBPromise = connectToPocketBase(
      validateEnvironmentVariables()
    )
      .then(
        pb => new PBService(pb, { id: 'api_keys' }) as PBService<{ entries: any }>
      )
      .catch(error => {
        privilegedAPIKeysPBPromise = null
        throw error
      })
  }

  const apiKeysPB = await privilegedAPIKeysPBPromise

  if (!apiKeysPB) {
    throw new Error('Failed to initialize privileged API keys service.')
  }

  return apiKeysPB as PBService<{ entries: any }>
}

export async function validateCallerAccess(
  callerModule: { source: 'app' | 'core'; id: string },
  id: string
) {
  if (callerModule.source === 'core') {
    return
  }

  const packageJSONPath = path.resolve(
    ROOT_DIR,
    'apps',
    callerModule.id,
    'package.json'
  )

  if (!fs.existsSync(packageJSONPath)) {
    throw new Error(`Manifest for ${callerModule.id} not found`)
  }

  const packageJSON = JSON.parse(fs.readFileSync(packageJSONPath, 'utf-8'))

  if (!packageJSON.lifeforge?.APIKeyAccess) {
    throw new Error(`API access for ${callerModule.id} not found`)
  }

  const access = packageJSON.lifeforge.APIKeyAccess[id]

  if (!access) {
    throw new Error(`API access for ${id} not found`)
  }
}

async function getAPIKey(
  id: string,
  callerModule?: { source: 'app' | 'core'; id: string }
): Promise<string> {
  try {
    if (!callerModule) {
      throw new Error(
        'Unable to determine caller module for API key validation.'
      )
    }

    await validateCallerAccess(callerModule, id)

    const apiKeysPB = await getAPIKeysPBService()

    const { key } = await apiKeysPB.getFirstListItem
      .collection('entries')
      .filter([
        {
          field: 'keyId',
          operator: '=',
          value: id
        }
      ])
      .execute()
      .catch(err => {
        throw new Error(`Failed to retrieve API key for ${id}: ${err.message}`)
      })

    try {
      logger.info(
        `API key for ${chalk.blue(id)} retrieved by ${chalk.blue(callerModule.source)}:${chalk.blue(callerModule.id)}`
      )

      return decrypt2(key, process.env.MASTER_KEY!)
    } catch {
      throw new Error(`Failed to decrypt API key for ${id}.`)
    }
  } catch (err) {
    throw new Error(
      `Failed to retrieve API key for ${id}: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

export default function getAPIKeyFactory(
  _pb: IPBService<any>,
  callerModule?: { source: 'app' | 'core'; id: string }
): (id: string) => Promise<string> {
  return (id: string) => getAPIKey(id, callerModule)
}
