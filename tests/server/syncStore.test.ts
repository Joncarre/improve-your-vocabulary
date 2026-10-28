import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '../../src/server/sync/memoryStore.ts'
import { fitPage, preparePush, type PulledRow, type StoredRow } from '../../src/server/sync/store.ts'
import { schemaStatements } from '../../src/server/sync/sqlStore.ts'
import { isNewer } from '../../src/shared/index.ts'
import { makeCard, makeEntry, makeTopic } from '../factories.ts'

function row(overrides: Partial<StoredRow> = {}): StoredRow {
  const topic = makeTopic()
  return { table: 'topics', id: topic.id, data: topic, updatedAt: topic.updatedAt, deleted: false, ...overrides }
}

describe('isNewer (last write wins)', () => {
  it('accepts anything when there is no stored copy', () => {
    expect(isNewer(0, undefined)).toBe(true)
  })

  it('only accepts a strictly newer copy', () => {
    expect(isNewer(11, 10)).toBe(true)
    expect(isNewer(10, 10)).toBe(false)
    expect(isNewer(9, 10)).toBe(false)
  })
})

describe('preparePush', () => {
  it('keeps valid records with the fields the table needs', () => {
    const entry = makeEntry({ updatedAt: 500, deletedAt: 500 })
    const { rows, rejected } = preparePush([{ table: 'entries', data: entry }])
    expect(rejected).toEqual([])
    expect(rows).toEqual([{ table: 'entries', id: entry.id, data: entry, updatedAt: 500, deleted: true }])
  })

  it('reports invalid records by position and still keeps the others', () => {
    const good = makeCard()
    const { rows, rejected } = preparePush([
      { table: 'entries', data: { id: 'x' } },
      { table: 'cards', data: good },
      { table: 'topics', data: null },
    ])
    expect(rejected).toEqual([0, 2])
    expect(rows.map((r) => r.id)).toEqual([good.id])
  })

  it('keeps only the newest copy when a record comes twice', () => {
    const topic = makeTopic()
    const { rows } = preparePush([
      { table: 'topics', data: { ...topic, nameEs: 'nuevo', updatedAt: 20 } },
      { table: 'topics', data: { ...topic, nameEs: 'viejo', updatedAt: 10 } },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ updatedAt: 20, data: { nameEs: 'nuevo' } })
  })

  it('treats the same id in two tables as two records', () => {
    const topic = makeTopic()
    const { rows } = preparePush([
      { table: 'topics', data: topic },
      { table: 'sources', data: { id: topic.id, title: 'x', type: 'film', lastUsedAt: 1, updatedAt: 1 } },
    ])
    expect(rows).toHaveLength(2)
  })
})

describe('memory store', () => {
  it('stores new records and gives each change a growing seq', async () => {
    const store = createMemoryStore()
    expect(await store.upsert([row(), row()])).toBe(2)
    const { rows, latest } = await store.pull(0, 10)
    expect(rows.map((r) => r.seq)).toEqual([1, 2])
    expect(latest).toBe(2)
  })

  it('replaces a record only when the incoming one is newer, and moves it to a new seq', async () => {
    const store = createMemoryStore()
    const first = row({ updatedAt: 10 })
    const other = row()
    await store.upsert([first, other])

    expect(await store.upsert([{ ...first, updatedAt: 9, data: 'older' }])).toBe(0)
    expect(await store.upsert([{ ...first, updatedAt: 10, data: 'same time' }])).toBe(0)
    expect(await store.upsert([{ ...first, updatedAt: 11, data: 'newer' }])).toBe(1)

    const { rows } = await store.pull(0, 10)
    expect(rows.map((r) => [r.id, r.data, r.seq])).toEqual([
      [other.id, other.data, 2],
      [first.id, 'newer', 3],
    ])
  })

  it('carries a deletion like any other change', async () => {
    const store = createMemoryStore()
    const live = row({ updatedAt: 5 })
    await store.upsert([live])
    await store.upsert([{ ...live, updatedAt: 6, deleted: true }])
    const { rows } = await store.pull(0, 10)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ deleted: true, updatedAt: 6 })
  })

  it('pulls in pages from a cursor', async () => {
    const store = createMemoryStore()
    await store.upsert(Array.from({ length: 5 }, () => row()))
    const first = await store.pull(0, 2)
    expect(first.rows.map((r) => r.seq)).toEqual([1, 2])
    const second = await store.pull(2, 2)
    expect(second.rows.map((r) => r.seq)).toEqual([3, 4])
    expect((await store.pull(5, 2)).rows).toEqual([])
  })
})

describe('fitPage', () => {
  const pulled = (seq: number, size: number): PulledRow => ({ ...row({ id: `r${seq}` }), seq, size })

  it('stops before the byte budget is passed', () => {
    const page = fitPage([pulled(1, 400), pulled(2, 400), pulled(3, 400)], 1_000)
    expect(page.map((r) => r.seq)).toEqual([1, 2])
  })

  it('always keeps the first row, however big', () => {
    expect(fitPage([pulled(1, 5_000), pulled(2, 10)], 1_000).map((r) => r.seq)).toEqual([1])
  })
})

describe('schema', () => {
  it('creates the records table of the spec with an index on seq', () => {
    const [table, index] = schemaStatements('records')
    expect(table).toContain('create table if not exists records')
    for (const column of ['tbl text', 'id text', 'data jsonb', 'updated_at bigint', 'deleted boolean', 'seq bigserial', 'primary key (tbl, id)']) {
      expect(table).toContain(column)
    }
    expect(index).toContain('on records (seq)')
  })
})
