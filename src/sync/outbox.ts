import { db } from '../db/db.ts'
import { SYNC_LIMITS, SYNC_TABLES, type SyncRecord, type SyncRow, type SyncTableName } from '../shared/index.ts'

/**
 * Records with these ids are development test data (src/dev): they never leave the device, so a
 * test collection cannot end up in the real database.
 */
export const LOCAL_ONLY_ID_PREFIX = 'seed-'

export function isLocalOnly(id: string): boolean {
  return id.startsWith(LOCAL_ONLY_ID_PREFIX)
}

/** Queues every local record, for the first sync of a device or after the server was emptied. */
export async function enqueueAll(now = Date.now()): Promise<number> {
  let queued = 0
  await db.transaction('rw', [...SYNC_TABLES.map((name) => db.table(name)), db.outbox], async () => {
    for (const table of SYNC_TABLES) {
      const ids = (await db.table<SyncRecord, string>(table).toCollection().primaryKeys()).filter((id) => !isLocalOnly(id))
      await db.outbox.bulkPut(ids.map((id) => ({ table, id, queuedAt: now })))
      queued += ids.length
    }
  })
  return queued
}

/** A record as it was when it went into a batch: what `settleBatch` compares against. */
export interface SentRecord {
  table: SyncTableName
  id: string
  queuedAt: number
  updatedAt: number
}

export interface PushBatch {
  rows: SyncRow[]
  /** One per row, in the same order. */
  sent: SentRecord[]
}

/**
 * The next records to upload, oldest first: at most 500, and closed before the JSON passes ~1 MB.
 * Outbox rows whose record no longer exists, and test data, are dropped here. Returns null when
 * nothing is waiting.
 */
export async function nextPushBatch(): Promise<PushBatch | null> {
  for (;;) {
    const queued = await db.outbox.orderBy('queuedAt').limit(SYNC_LIMITS.pushRecords).toArray()
    if (queued.length === 0) return null

    const records = await Promise.all(
      queued.map((item) => (isLocalOnly(item.id) ? undefined : db.table<SyncRecord, string>(item.table).get(item.id))),
    )
    const rows: SyncRow[] = []
    const sent: SentRecord[] = []
    const dropped: [string, string][] = []
    let bytes = 0
    for (const [index, item] of queued.entries()) {
      const record = records[index]
      if (!record) {
        dropped.push([item.table, item.id])
        continue
      }
      const size = JSON.stringify(record).length
      if (rows.length > 0 && bytes + size > SYNC_LIMITS.pushBytes) break
      bytes += size
      rows.push({ table: item.table, data: record })
      sent.push({ table: item.table, id: item.id, queuedAt: item.queuedAt, updatedAt: record.updatedAt })
    }
    if (dropped.length > 0) await db.outbox.bulkDelete(dropped)
    // Everything in this slice was dropped: look at the next one.
    if (rows.length > 0) return { rows, sent }
  }
}

/**
 * Takes the uploaded records out of the outbox, but only those that did not change while the
 * request was on its way: a record edited in the meantime was queued again and stays queued.
 */
export async function settleBatch(sent: readonly SentRecord[]): Promise<void> {
  await db.transaction('rw', [...SYNC_TABLES.map((name) => db.table(name)), db.outbox], async () => {
    for (const item of sent) {
      const queued = await db.outbox.get([item.table, item.id])
      if (!queued || queued.queuedAt !== item.queuedAt) continue
      const record = await db.table<SyncRecord, string>(item.table).get(item.id)
      if (record && record.updatedAt !== item.updatedAt) continue
      await db.outbox.delete([item.table, item.id])
    }
  })
}
