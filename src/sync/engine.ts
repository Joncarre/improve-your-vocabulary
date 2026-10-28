import { applyRecords, type TableRecord } from '../db/bulk.ts'
import { loadDeviceSettings, saveDeviceSettings } from '../db/settings.ts'
import { parseSyncRecord, SYNC_LIMITS } from '../shared/index.ts'
import { pullRecords, pushRecords, SyncError, type CallOptions } from './client.ts'
import { enqueueAll, nextPushBatch, settleBatch } from './outbox.ts'

export interface SyncOptions {
  signal?: AbortSignal
  /** Replaceable for tests. */
  fetchImpl?: typeof fetch
  now?: () => number
  /** Page size of the pull (the server's own maximum by default); tests make it small. */
  pullLimit?: number
}

export interface SyncReport {
  /** Records the server accepted. */
  pushed: number
  /** Records the server refused as invalid (they are dropped from the outbox). */
  rejected: number
  /** Records received. */
  pulled: number
  /** Of those, the ones that were newer than the local copy. */
  applied: number
  /** Received records that did not pass validation and were ignored. */
  invalid: number
}

/** Pages and batches per run: a guard against a server that never says "done". */
const MAX_ROUNDS = 400

async function pushAll(options: CallOptions, report: SyncReport): Promise<void> {
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const batch = await nextPushBatch()
    if (!batch) return
    const response = await pushRecords(batch.rows, options)
    report.pushed += response.applied
    report.rejected += response.rejected.length
    await settleBatch(batch.sent)
  }
}

/**
 * Pulls everything above the cursor. Returns 'reset' when the server is behind the cursor, which
 * means its database was emptied or replaced and everything local has to be uploaded again.
 */
async function pullAll(options: CallOptions, report: SyncReport, limit: number | undefined): Promise<'done' | 'reset'> {
  const { syncCursor } = await loadDeviceSettings()
  let cursor = syncCursor
  // The first request goes a little back: a change that was committed late can carry a lower `seq`
  // than one already seen. Applying a record twice changes nothing.
  let from = Math.max(0, cursor - SYNC_LIMITS.pullOverlap)

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const page = await pullRecords(from, limit, options)
    if (round === 0 && page.latest < cursor) return 'reset'

    const records: TableRecord[] = []
    for (const row of page.records) {
      const parsed = parseSyncRecord(row.table, row.data)
      if (parsed.ok) records.push({ table: parsed.table, record: parsed.record })
      else report.invalid += 1
    }
    const result = await applyRecords(records, { enqueue: false })
    report.pulled += page.records.length
    report.applied += result.applied

    from = page.cursor
    if (page.cursor > cursor) {
      cursor = page.cursor
      await saveDeviceSettings({ syncCursor: cursor })
    }
    if (!page.hasMore || page.records.length === 0) return 'done'
  }
  return 'done'
}

/**
 * One synchronisation: upload what is in the outbox, then download what is new. A device that has
 * never synced uploads everything it has first. Throws {@link SyncError}; whatever was done before
 * the failure stays done, and the next run continues from there.
 */
export async function runSync(options: SyncOptions = {}): Promise<SyncReport> {
  const now = options.now ?? Date.now
  const settings = await loadDeviceSettings()
  const secret = settings.appSecret.trim()
  if (!secret) throw new SyncError('unauthorized', 'Falta el secreto: introdúcelo en Ajustes.')

  const callOptions: CallOptions = { secret }
  if (options.signal) callOptions.signal = options.signal
  if (options.fetchImpl) callOptions.fetchImpl = options.fetchImpl
  const report: SyncReport = { pushed: 0, rejected: 0, pulled: 0, applied: 0, invalid: 0 }

  if (settings.lastSyncOkAt === undefined) await enqueueAll(now())

  for (let attempt = 0; ; attempt += 1) {
    await pushAll(callOptions, report)
    if ((await pullAll(callOptions, report, options.pullLimit)) === 'done') break
    if (attempt >= 1) throw new SyncError('invalid_response', 'El servidor no tiene los datos que debería tener. Inténtalo de nuevo.')
    await enqueueAll(now())
    await saveDeviceSettings({ syncCursor: 0 })
  }

  const finished = now()
  await saveDeviceSettings({ lastSyncAt: finished, lastSyncOkAt: finished })
  return report
}
