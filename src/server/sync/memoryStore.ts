import { isNewer } from '../../shared/index.js'
import type { PullPage, RecordStore, StoredRow } from './store.js'

/** The same rules as the Postgres store, in memory: used by the tests and to check the client without a database. */
export function createMemoryStore(): RecordStore & { rows: Map<string, StoredRow & { seq: number }>; reset(): void } {
  const rows = new Map<string, StoredRow & { seq: number }>()
  let seq = 0

  return {
    rows,
    reset() {
      rows.clear()
      seq = 0
    },
    ensureSchema() {
      return Promise.resolve()
    },
    upsert(incoming) {
      let changed = 0
      for (const row of incoming) {
        const key = `${row.table}:${row.id}`
        if (!isNewer(row.updatedAt, rows.get(key)?.updatedAt)) continue
        seq += 1
        rows.set(key, { ...row, seq })
        changed += 1
      }
      return Promise.resolve(changed)
    },
    pull(cursor, limit): Promise<PullPage> {
      const page = [...rows.values()]
        .filter((row) => row.seq > cursor)
        .sort((a, b) => a.seq - b.seq)
        .slice(0, limit)
        .map((row) => ({ ...row, size: JSON.stringify(row.data).length }))
      return Promise.resolve({ rows: page, latest: seq })
    },
  }
}
