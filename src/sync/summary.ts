/** How long without a successful sync before the app warns that the data only lives on this device. */
export const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000

export type SyncKind = 'off' | 'syncing' | 'offline' | 'error' | 'pending' | 'synced'

export interface SyncSummaryInput {
  hasSecret: boolean
  running: boolean
  online: boolean
  error: { code: string; message: string } | null
  /** Records waiting in the outbox. */
  pending: number
}

export interface SyncSummary {
  kind: SyncKind
  /** Short text for the indicator. */
  label: string
}

const LABEL: Record<SyncKind, string> = {
  off: 'Sin configurar',
  syncing: 'Sincronizando…',
  offline: 'Sin conexión',
  error: 'Error al sincronizar',
  pending: 'Pendiente de subir',
  synced: 'Sincronizado',
}

/** The one state the indicator shows, from the most to the least urgent. */
export function summarizeSync(input: SyncSummaryInput): SyncSummary {
  const kind = pick(input)
  return { kind, label: LABEL[kind] }
}

function pick({ hasSecret, running, online, error, pending }: SyncSummaryInput): SyncKind {
  if (!hasSecret) return 'off'
  if (running) return 'syncing'
  if (!online || error?.code === 'network' || error?.code === 'timeout') return 'offline'
  if (error) return 'error'
  return pending > 0 ? 'pending' : 'synced'
}

/**
 * Whether to warn that the data has not left this device for too long. For a device that has never
 * synced, the reference is its oldest word.
 */
export function isSyncStale(input: { lastOkAt: number | undefined; oldestEntryAt: number | undefined; now: number }): boolean {
  const since = input.lastOkAt ?? input.oldestEntryAt
  return since !== undefined && input.now - since > STALE_AFTER_MS
}

/** "hace 5 min", "hace 2 h", "ayer"… for the last successful sync. */
export function formatAgo(at: number, now: number): string {
  const minutes = Math.floor((now - at) / 60_000)
  if (minutes < 1) return 'ahora mismo'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'hace 1 día' : `hace ${days} días`
}
