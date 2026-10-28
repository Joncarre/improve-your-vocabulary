import { PGlite } from '@electric-sql/pglite'
import { afterAll, describe, expect, it } from 'vitest'
import { createMemoryStore } from '../../src/server/sync/memoryStore.ts'
import { createSqlStore, type SqlRunner } from '../../src/server/sync/sqlStore.ts'
import type { RecordStore, StoredRow } from '../../src/server/sync/store.ts'
import { makeEntry, makeTopic } from '../factories.ts'

/*
 * The same behaviour is asked of the in-memory store and of the real SQL, run by PGlite (Postgres
 * compiled to WebAssembly). That is how the statements of the Neon store are checked without a database.
 */

const databases: PGlite[] = []

function pgliteRunner(): SqlRunner {
  const pg = new PGlite()
  databases.push(pg)
  return {
    async query(text, params) {
      return (await pg.query(text, params)).rows as Record<string, unknown>[]
    },
    async transaction(statements) {
      return pg.transaction(async (tx) => {
        const results: Record<string, unknown>[][] = []
        for (const statement of statements) results.push((await tx.query(statement.text, statement.params)).rows as Record<string, unknown>[])
        return results
      })
    },
  }
}

afterAll(async () => {
  await Promise.all(databases.map((pg) => pg.close()))
})

const row = (overrides: Partial<StoredRow> = {}): StoredRow => {
  const topic = makeTopic()
  return { table: 'topics', id: topic.id, data: topic, updatedAt: topic.updatedAt, deleted: false, ...overrides }
}

const stores: [string, () => Promise<RecordStore>][] = [
  ['memory store', async () => createMemoryStore()],
  [
    'SQL store on Postgres (PGlite)',
    async () => {
      const store = createSqlStore(pgliteRunner())
      await store.ensureSchema()
      return store
    },
  ],
]

describe.each(stores)('%s', (_name, create) => {
  it('stores new rows and gives each change a growing seq', async () => {
    const store = await create()
    expect(await store.upsert([row(), row()])).toBe(2)
    const { rows, latest } = await store.pull(0, 10)
    expect(rows.map((r) => r.seq)).toEqual([1, 2])
    expect(latest).toBe(2)
  })

  it('hands the data back as it was stored', async () => {
    const store = await create()
    const entry = makeEntry({ updatedAt: 77, learnerNote: 'ñandú «raro» "comillas" \\ barra' })
    await store.upsert([{ table: 'entries', id: entry.id, data: entry, updatedAt: 77, deleted: false }])
    const { rows } = await store.pull(0, 10)
    expect(rows[0]).toMatchObject({ table: 'entries', id: entry.id, updatedAt: 77, deleted: false })
    expect(rows[0]?.data).toEqual(entry)
    expect(rows[0]?.size).toBeGreaterThan(100)
  })

  it('replaces a row only when the incoming one is strictly newer, and moves it to a newer seq', async () => {
    const store = await create()
    const first = row({ updatedAt: 10 })
    const other = row()
    await store.upsert([first, other])

    expect(await store.upsert([{ ...first, updatedAt: 9, data: 'older' }])).toBe(0)
    expect(await store.upsert([{ ...first, updatedAt: 10, data: 'same time' }])).toBe(0)
    expect(await store.upsert([{ ...first, updatedAt: 11, data: 'newer' }])).toBe(1)

    // Postgres leaves gaps in seq for rejected rows, so only the order is guaranteed.
    const { rows, latest } = await store.pull(0, 10)
    expect(rows.map((r) => [r.id, r.data])).toEqual([
      [other.id, other.data],
      [first.id, 'newer'],
    ])
    expect(rows[1]?.seq).toBeGreaterThan(rows[0]?.seq ?? Infinity)
    expect(latest).toBe(rows[1]?.seq)
  })

  it('counts only the rows that changed in a mixed batch', async () => {
    const store = await create()
    const a = row({ updatedAt: 5 })
    const b = row({ updatedAt: 5 })
    await store.upsert([a, b])
    expect(await store.upsert([{ ...a, updatedAt: 6 }, { ...b, updatedAt: 4 }, row()])).toBe(2)
  })

  it('keeps the same id in two tables apart', async () => {
    const store = await create()
    await store.upsert([row({ id: 'same', table: 'topics' }), row({ id: 'same', table: 'sources' })])
    expect((await store.pull(0, 10)).rows.map((r) => r.table)).toEqual(['topics', 'sources'])
  })

  it('carries a deletion like any other change', async () => {
    const store = await create()
    const live = row({ updatedAt: 5 })
    await store.upsert([live])
    await store.upsert([{ ...live, updatedAt: 6, deleted: true }])
    const { rows } = await store.pull(0, 10)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ deleted: true, updatedAt: 6 })
  })

  it('pulls in pages from a cursor and reports the highest seq', async () => {
    const store = await create()
    await store.upsert(Array.from({ length: 5 }, () => row()))
    expect((await store.pull(0, 2)).rows.map((r) => r.seq)).toEqual([1, 2])
    expect((await store.pull(2, 2)).rows.map((r) => r.seq)).toEqual([3, 4])
    const end = await store.pull(5, 2)
    expect(end.rows).toEqual([])
    expect(end.latest).toBe(5)
  })

  it('keeps timestamps in milliseconds exact (bigint)', async () => {
    const store = await create()
    const now = 1_793_196_074_233
    await store.upsert([row({ updatedAt: now })])
    expect((await store.pull(0, 1)).rows[0]?.updatedAt).toBe(now)
  })

  it('does nothing for an empty batch and reports an empty table', async () => {
    const store = await create()
    expect(await store.upsert([])).toBe(0)
    expect(await store.pull(0, 10)).toEqual({ rows: [], latest: 0 })
  })
})

describe('SQL store only', () => {
  it('creates the schema again without error (every cold start does)', async () => {
    const store = createSqlStore(pgliteRunner())
    await store.ensureSchema()
    await store.ensureSchema()
    await store.upsert([row()])
    await store.ensureSchema()
    expect((await store.pull(0, 10)).rows).toHaveLength(1)
  })

  it('works on another table name, leaving the real one alone', async () => {
    const runner = pgliteRunner()
    const real = createSqlStore(runner)
    const test = createSqlStore(runner, 'records_test')
    await real.ensureSchema()
    await test.ensureSchema()
    await test.upsert([row()])
    expect((await real.pull(0, 10)).rows).toHaveLength(0)
    expect((await test.pull(0, 10)).rows).toHaveLength(1)
  })

  it('refuses table names that could carry SQL', () => {
    expect(() => createSqlStore(pgliteRunner(), 'records; drop table records')).toThrow('Invalid table name')
    expect(() => createSqlStore(pgliteRunner(), 'Records')).toThrow('Invalid table name')
  })

  it('has the index on seq and the primary key of the spec', async () => {
    const runner = pgliteRunner()
    await createSqlStore(runner).ensureSchema()
    const indexes = await runner.query(`select indexname from pg_indexes where tablename = 'records' order by indexname`)
    expect(indexes.map((r) => r.indexname)).toEqual(['records_pkey', 'records_seq_idx'])
  })
})
