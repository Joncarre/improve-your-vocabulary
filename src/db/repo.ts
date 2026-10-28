import type { Table } from 'dexie'
import type {
  Card,
  Entry,
  GameResult,
  ReviewLog,
  SharedSettings,
  Source,
  Story,
  SyncTableName,
  Topic,
} from '../shared/index.ts'
import { db } from './db.ts'

/** Record type of every synced table. */
export interface TableRecords {
  entries: Entry
  cards: Card
  logs: ReviewLog
  sources: Source
  topics: Topic
  games: GameResult
  stories: Story
  sharedSettings: SharedSettings
}

// Compile-time check: TableRecords covers exactly the synced tables.
type AssertSameKeys = [keyof TableRecords] extends [SyncTableName]
  ? [SyncTableName] extends [keyof TableRecords]
    ? true
    : never
  : never
export const tableRecordsCoverSyncTables: AssertSameKeys = true

export interface WriteOptions {
  /**
   * Queue the record for upload (default). Turn it off only when applying data that came
   * from the server, so it is not sent straight back.
   */
  enqueue?: boolean
  /** Keep the record's own `updatedAt` instead of stamping the current time (remote data). */
  keepUpdatedAt?: boolean
  /** Clock override, for tests. */
  now?: number
}

function tableOf<N extends SyncTableName>(name: N): Table<TableRecords[N], string> {
  return db.table<TableRecords[N], string>(name)
}

/**
 * Create or replace a record. In one transaction it stamps `updatedAt` and queues the
 * record in the outbox, so no change can be saved without being scheduled for sync.
 */
export async function writeRecord<N extends SyncTableName>(
  name: N,
  record: TableRecords[N],
  options: WriteOptions = {},
): Promise<TableRecords[N]> {
  const { enqueue = true, keepUpdatedAt = false, now = Date.now() } = options
  const next: TableRecords[N] = keepUpdatedAt ? record : { ...record, updatedAt: now }
  await db.transaction('rw', tableOf(name), db.outbox, async () => {
    await tableOf(name).put(next)
    if (enqueue) await db.outbox.put({ table: name, id: next.id, queuedAt: now })
  })
  return next
}

/**
 * Logical deletion: the record stays in the table with `deletedAt` set, so the deletion
 * can travel to the other devices. Returns false when the record does not exist.
 */
export async function softDeleteRecord<N extends SyncTableName>(
  name: N,
  id: string,
  options: Pick<WriteOptions, 'enqueue' | 'now'> = {},
): Promise<boolean> {
  const { enqueue = true, now = Date.now() } = options
  return db.transaction('rw', tableOf(name), db.outbox, async () => {
    const current = await tableOf(name).get(id)
    if (!current) return false
    await tableOf(name).put({ ...current, deletedAt: now, updatedAt: now })
    if (enqueue) await db.outbox.put({ table: name, id, queuedAt: now })
    return true
  })
}

/** A record that exists and has not been deleted. */
export async function getActive<N extends SyncTableName>(
  name: N,
  id: string,
): Promise<TableRecords[N] | undefined> {
  const record = await tableOf(name).get(id)
  return record && record.deletedAt === undefined ? record : undefined
}

/** Every record that has not been deleted. */
export async function listActive<N extends SyncTableName>(name: N): Promise<TableRecords[N][]> {
  return tableOf(name)
    .filter((record) => record.deletedAt === undefined)
    .toArray()
}
