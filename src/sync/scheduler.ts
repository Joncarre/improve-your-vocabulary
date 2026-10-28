import { loadDeviceSettings, saveDeviceSettings } from '../db/settings.ts'
import { SyncError } from './client.ts'
import { runSync, type SyncOptions } from './engine.ts'
import { setSyncStatus } from './status.ts'

let current: Promise<void> | null = null
let again = false

function describeFailure(error: unknown): { code: string; message: string } {
  if (error instanceof SyncError) return { code: error.code, message: error.message }
  console.error('[sync] unexpected error', error instanceof Error ? error.message : error)
  return { code: 'unknown', message: 'La sincronización ha fallado. Se reintentará sola.' }
}

/** One run: false when it failed or had nothing to work with. */
async function cycle(options: SyncOptions): Promise<boolean> {
  const settings = await loadDeviceSettings()
  // Without the secret there is nowhere to sync to; the indicator says so.
  if (!settings.appSecret.trim()) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false

  setSyncStatus({ running: true })
  try {
    const report = await runSync(options)
    const skipped = report.rejected + report.invalid
    setSyncStatus({
      running: false,
      error: null,
      warning: skipped > 0 ? `${skipped === 1 ? 'Un registro no se ha podido' : `${skipped} registros no se han podido`} sincronizar.` : null,
    })
    return true
  } catch (error) {
    setSyncStatus({ running: false, error: describeFailure(error) })
    // The attempt is recorded even though it failed (`lastSyncOkAt` stays as it was).
    await saveDeviceSettings({ lastSyncAt: Date.now() }).catch(() => undefined)
    return false
  }
}

/**
 * Asks for a synchronisation. Only one runs at a time: a request that arrives meanwhile does not
 * start a second one, it makes the running one go round once more when it finishes (the request
 * may have been about a change made after it started). Resolves when everything asked for is done.
 */
export function requestSync(options: SyncOptions = {}): Promise<void> {
  if (current) {
    again = true
    return current
  }
  current = (async () => {
    try {
      do {
        again = false
        // After a failure there is no point in going round again straight away.
        if (!(await cycle(options))) again = false
      } while (again)
    } finally {
      current = null
    }
  })()
  return current
}

/** True while a run is going (used by tests). */
export function isSyncing(): boolean {
  return current !== null
}
