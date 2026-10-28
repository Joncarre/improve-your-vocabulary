import type { SyncTableName } from '../../shared/index.js'
import type { PulledRow, PullPage, RecordStore, StoredRow } from './store.js'

export interface SqlStatement {
  text: string
  params?: unknown[]
}

/** What the store needs from a Postgres connection: Neon over HTTP in production, PGlite in the tests. */
export interface SqlRunner {
  /** Runs one statement and returns its rows. */
  query(text: string, params?: unknown[]): Promise<Record<string, unknown>[]>
  /** Runs the statements in order as one transaction and returns the rows of each. */
  transaction(statements: SqlStatement[]): Promise<Record<string, unknown>[][]>
}

const IDENTIFIER = /^[a-z_][a-z0-9_]{0,40}$/

/** `records` as spec §10 defines it, plus the index that makes `seq > cursor` cheap. Also kept in the README. */
export function schemaStatements(table: string): string[] {
  return [
    `create table if not exists ${table} (
      tbl text not null,
      id text not null,
      data jsonb not null,
      updated_at bigint not null,
      deleted boolean not null default false,
      seq bigserial,
      primary key (tbl, id)
    )`,
    `create index if not exists ${table}_seq_idx on ${table} (seq)`,
  ]
}

/**
 * The records table in Postgres. Every change, new or not, gets a fresh `seq` from the table's own
 * sequence (`excluded.seq` is the value the proposed row was given); an update only goes through when
 * its `updated_at` is higher than the stored one. Postgres evaluates the default of a row that then
 * conflicts, so rejected rows leave gaps in `seq`: harmless, it only ever grows.
 * `table` can be changed for tests, so they never touch the real records.
 */
export function createSqlStore(runner: SqlRunner, table = 'records'): RecordStore {
  if (!IDENTIFIER.test(table)) throw new Error('Invalid table name')

  const create = () => runner.transaction(schemaStatements(table).map((text) => ({ text })))

  return {
    async ensureSchema() {
      try {
        await create()
      } catch {
        // Two first requests at once can collide while creating the table; the second try finds it.
        await create()
      }
    },

    async upsert(rows: StoredRow[]) {
      if (rows.length === 0) return 0
      const payload = rows.map((row) => ({
        tbl: row.table,
        id: row.id,
        data: row.data,
        updated_at: row.updatedAt,
        deleted: row.deleted,
      }))
      const changed = await runner.query(
        `insert into ${table} as r (tbl, id, data, updated_at, deleted)
         select tbl, id, data, updated_at, deleted
         from jsonb_to_recordset($1::jsonb) as x(tbl text, id text, data jsonb, updated_at bigint, deleted boolean)
         on conflict (tbl, id) do update
           set data = excluded.data,
               updated_at = excluded.updated_at,
               deleted = excluded.deleted,
               seq = excluded.seq
           where excluded.updated_at > r.updated_at
         returning 1`,
        [JSON.stringify(payload)],
      )
      return changed.length
    },

    async pull(cursor: number, limit: number): Promise<PullPage> {
      const [page = [], latest = []] = await runner.transaction([
        {
          // bigint columns come back as text: the driver would otherwise hand them over as strings or bigints.
          text: `select seq::text as seq, tbl, id, data, updated_at::text as updated_at, deleted,
                        octet_length(data::text) as size
                 from ${table} where seq > $1 order by seq asc limit $2`,
          params: [cursor, limit],
        },
        { text: `select coalesce(max(seq), 0)::text as latest from ${table}` },
      ])
      const rows = page.map(
        (row): PulledRow => ({
          seq: Number(row.seq),
          table: row.tbl as SyncTableName,
          id: String(row.id),
          data: row.data,
          updatedAt: Number(row.updated_at),
          deleted: row.deleted === true,
          size: Number(row.size),
        }),
      )
      return { rows, latest: Number(latest[0]?.latest ?? 0) }
    },
  }
}
