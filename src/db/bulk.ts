import type { Table } from 'dexie'
import { isNewer, SYNC_TABLES, type SyncRecord, type SyncTableName } from '../shared/index.ts'
import { db } from './db.ts'

/** A record together with the table it belongs to. */
export interface TableRecord {
  table: SyncTableName
  record: SyncRecord
}

export interface ApplyOptions {
  /** Queue what was applied for upload (imports). Off for data that came from the server. */
  enqueue: boolean
  /** Clock override, for tests. */
  now?: number
}

export interface ApplyResult {
  applied: number
  skipped: number
}

export interface ReplaceResult {
  /** Records of the file that are now on this device. */
  restored: number
  /** Records that were here and not in the file, now deleted logically. */
  removed: number
}

function tableOf(name: SyncTableName): Table<SyncRecord, string> {
  return db.table<SyncRecord, string>(name)
}

const SYNC_STORES = () => [...SYNC_TABLES.map((name) => db.table(name)), db.outbox]

/** Groups records by table, keeping only the newest copy when an id appears more than once. */
function groupNewest(records: readonly TableRecord[]): Map<SyncTableName, Map<string, SyncRecord>> {
  const groups = new Map<SyncTableName, Map<string, SyncRecord>>()
  for (const { table, record } of records) {
    let group = groups.get(table)
    if (!group) {
      group = new Map()
      groups.set(table, group)
    }
    const previous = group.get(record.id)
    if (!previous || record.updatedAt > previous.updatedAt) group.set(record.id, record)
  }
  return groups
}

/**
 * Last write wins: stores each record unless this device already has a copy at least as new.
 * Used for what the server sends (no outbox) and for merging an imported backup (queued for upload).
 * A record that replaces a local one also drops that one's pending upload, since it is now stale.
 */
export async function applyRecords(records: readonly TableRecord[], options: ApplyOptions): Promise<ApplyResult> {
  const { enqueue, now = Date.now() } = options
  const groups = groupNewest(records)
  let applied = 0
  let skipped = 0
  await db.transaction('rw', SYNC_STORES(), async () => {
    for (const [name, group] of groups) {
      const table = tableOf(name)
      const incoming = [...group.values()]
      const local = await table.bulkGet(incoming.map((record) => record.id))
      const winners = incoming.filter((record, index) => isNewer(record.updatedAt, local[index]?.updatedAt))
      skipped += incoming.length - winners.length
      applied += winners.length
      if (winners.length === 0) continue
      await table.bulkPut(winners)
      if (enqueue) await db.outbox.bulkPut(winners.map((record) => ({ table: name, id: record.id, queuedAt: now })))
      else await db.outbox.bulkDelete(winners.map((record): [string, string] => [name, record.id]))
    }
  })
  return { applied, skipped }
}

/**
 * Makes this device hold exactly the given records ("Reemplazar todo", decision B10). Every record
 * of the file is stamped with the current time so it wins over any copy the server or the other
 * devices have, and what is not in the file is deleted logically (not removed), so the deletion
 * travels too instead of the server sending it back.
 */
export async function replaceAllRecords(records: readonly TableRecord[], now = Date.now()): Promise<ReplaceResult> {
  const groups = groupNewest(records)
  let restored = 0
  let removed = 0
  await db.transaction('rw', SYNC_STORES(), async () => {
    for (const name of SYNC_TABLES) {
      const table = tableOf(name)
      const wanted = groups.get(name) ?? new Map<string, SyncRecord>()
      const stamped = [...wanted.values()].map(
        (record): SyncRecord => ({ ...record, updatedAt: now, ...(record.deletedAt === undefined ? {} : { deletedAt: now }) }),
      )
      const gone: SyncRecord[] = []
      // The settings are a single record: a file without them leaves the current ones alone.
      if (name !== 'sharedSettings') {
        await table.each((local) => {
          if (local.deletedAt === undefined && !wanted.has(local.id)) gone.push({ ...local, deletedAt: now, updatedAt: now })
        })
      }
      await table.bulkPut([...stamped, ...gone])
      await db.outbox.bulkPut([...stamped, ...gone].map((record) => ({ table: name, id: record.id, queuedAt: now })))
      restored += stamped.length
      removed += gone.length
    }
  })
  return { restored, removed }
}
