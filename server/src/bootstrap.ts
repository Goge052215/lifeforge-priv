import { MEDIA_DIR } from '@constants'
import checkDB from '@functions/database/dbUtils'
import ensureCredentials from '@functions/initialization/ensureCredentials'
import { LocaleService } from '@functions/initialization/localeService'
import fs from 'fs'

let initializationPromise: Promise<void> | undefined

export function ensureDirectories(): void {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true })
  }
}

export function initializeServer(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      LocaleService.validateAndLoad()
      ensureDirectories()
      ensureCredentials()
      await checkDB()
    })().catch(error => {
      initializationPromise = undefined
      throw error
    })
  }

  return initializationPromise
}
