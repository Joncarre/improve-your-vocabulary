import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useSyncExternalStore } from 'react'
import { db } from '../db/db.ts'
import { useDeviceSettings } from '../db/settings.ts'
import { useSyncStatus, type SyncFailure } from './status.ts'
import { isSyncStale, summarizeSync, type SyncSummary } from './summary.ts'

function subscribeOnline(listener: () => void): () => void {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

/** Whether the browser thinks it has a connection (`true` where it cannot tell). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  )
}

export interface SyncOverview extends SyncSummary {
  /** Records waiting to be uploaded. */
  pending: number
  lastOkAt: number | undefined
  error: SyncFailure | null
  warning: string | null
  hasSecret: boolean
}

/** Everything the indicator and the Ajustes section show about the synchronisation. */
export function useSyncOverview(): SyncOverview {
  const { settings } = useDeviceSettings()
  const status = useSyncStatus()
  const online = useOnline()
  const pending = useLiveQuery(() => db.outbox.count(), [], 0)
  const hasSecret = settings.appSecret.trim() !== ''
  const summary = summarizeSync({ hasSecret, running: status.running, online, error: status.error, pending })
  return { ...summary, pending, lastOkAt: settings.lastSyncOkAt, error: status.error, warning: status.warning, hasSecret }
}

/** True when the data has not been uploaded for more than a week (see {@link isSyncStale}). */
export function useSyncStale(): boolean {
  const { settings } = useDeviceSettings()
  const [now] = useState(() => Date.now())
  const oldest = useLiveQuery(async () => (await db.entries.orderBy('createdAt').first())?.createdAt ?? null, [])
  if (oldest === undefined) return false
  return isSyncStale({ lastOkAt: settings.lastSyncOkAt, oldestEntryAt: oldest ?? undefined, now })
}
