import { metaOf, parseSyncRecord, type SyncRow, type SyncTableName } from '../../shared/index.js'

/** One record as the server keeps it. */
export interface StoredRow {
  table: SyncTableName
  id: string
  data: unknown
  updatedAt: number
  deleted: boolean
}

export interface PulledRow extends StoredRow {
  seq: number
  /** Bytes of JSON in `data`, to keep a page under the response limit. */
  size: number
}

export interface PullPage {
  rows: PulledRow[]
  /** Highest `seq` in the whole table. */
  latest: number
}

/** Where the records live: Postgres in production, memory in tests. */
export interface RecordStore {
  /** Creates what is missing (idempotent). */
  ensureSchema(): Promise<void>
  /** Stores the rows that are newer than the stored ones, each with a new `seq`; returns how many changed. */
  upsert(rows: StoredRow[]): Promise<number>
  /** Rows with `seq` above the cursor, oldest first. */
  pull(cursor: number, limit: number): Promise<PullPage>
}

export interface PreparedPush {
  rows: StoredRow[]
  /** Positions of the records that are not valid. */
  rejected: number[]
}

/**
 * Validates a pushed batch. Invalid records are reported and left out, so one bad record cannot
 * block the rest; if the same record appears twice only the newest copy is kept (a statement
 * cannot change a row twice).
 */
export function preparePush(records: readonly SyncRow[]): PreparedPush {
  const rejected: number[] = []
  const latest = new Map<string, StoredRow>()
  records.forEach((row, index) => {
    const parsed = parseSyncRecord(row.table, row.data)
    if (!parsed.ok) {
      rejected.push(index)
      return
    }
    const meta = metaOf(parsed.record)
    const key = `${parsed.table}:${meta.id}`
    const previous = latest.get(key)
    if (previous && previous.updatedAt > meta.updatedAt) return
    latest.set(key, { table: parsed.table, id: meta.id, data: parsed.record, updatedAt: meta.updatedAt, deleted: meta.deleted })
  })
  return { rows: [...latest.values()], rejected }
}

/**
 * Cuts a page so its JSON stays under the budget. It always keeps the first row, so a single big
 * record cannot stall the sync.
 */
export function fitPage(rows: readonly PulledRow[], maxBytes: number): PulledRow[] {
  const page: PulledRow[] = []
  let bytes = 0
  for (const row of rows) {
    if (page.length > 0 && bytes + row.size > maxBytes) break
    page.push(row)
    bytes += row.size
  }
  return page
}
