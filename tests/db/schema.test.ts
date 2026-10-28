import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { createDatabase } from '../../src/db/db.ts'

const EXPECTED_INDEXES: Record<string, string[]> = {
  entries: ['lemmaKey', 'status', 'topicIds', 'createdAt', 'updatedAt'],
  cards: ['entryId', 'due', 'type'],
  logs: ['at', 'cardId', 'entryId', 'origin'],
  sources: ['title', 'lastUsedAt'],
  topics: ['nameEs'],
  games: ['game', 'at'],
  stories: ['createdAt'],
  sharedSettings: [],
  deviceSettings: [],
  outbox: ['queuedAt'],
}

async function withDatabase(run: (database: ReturnType<typeof createDatabase>) => Promise<void>) {
  const database = createDatabase(`schema-test-${crypto.randomUUID()}`)
  await database.open()
  try {
    await run(database)
  } finally {
    database.close()
    await database.delete()
  }
}

describe('database schema', () => {
  it('is version 1 and declares every table with the expected indexes', async () => {
    await withDatabase(async (database) => {
      expect(database.verno).toBe(1)
      expect(database.tables.map((table) => table.name).sort()).toEqual(Object.keys(EXPECTED_INDEXES).sort())
      for (const table of database.tables) {
        const indexes = table.schema.indexes.map((index) => index.name).sort()
        expect(indexes, table.name).toEqual([...(EXPECTED_INDEXES[table.name] ?? [])].sort())
      }
    })
  })

  it('keys records by their string id, and the outbox by [table+id]', async () => {
    await withDatabase(async (database) => {
      for (const table of database.tables) {
        const expected = table.name === 'outbox' ? ['table', 'id'] : 'id'
        expect(table.schema.primKey.keyPath, table.name).toEqual(expected)
      }
    })
  })

  it('indexes topicIds as a multi-entry index', async () => {
    await withDatabase(async (database) => {
      const index = database.entries.schema.indexes.find((candidate) => candidate.name === 'topicIds')
      expect(index?.multi).toBe(true)
    })
  })

  it('does not index booleans: they are not valid IndexedDB keys', async () => {
    await withDatabase(async (database) => {
      const indexed = database.tables.flatMap((table) => table.schema.indexes.map((index) => index.name))
      for (const booleanField of ['suspended', 'unlocked', 'isLeech', 'matchesContext']) {
        expect(indexed).not.toContain(booleanField)
      }
    })
  })
})

describe('schema migrations (pattern for future versions)', () => {
  it('runs an upgrade over data written by the previous version', async () => {
    const name = `migration-test-${crypto.randomUUID()}`

    const before = new Dexie(name)
    before.version(1).stores({ items: 'id' })
    await before.open()
    await before.table('items').put({ id: 'a', value: 2 })
    before.close()

    const after = new Dexie(name)
    after.version(1).stores({ items: 'id' })
    after
      .version(2)
      .stores({ items: 'id, doubled' })
      .upgrade((transaction) =>
        transaction
          .table('items')
          .toCollection()
          .modify((item: { value: number; doubled?: number }) => {
            item.doubled = item.value * 2
          }),
      )
    await after.open()
    try {
      expect(await after.table('items').get('a')).toEqual({ id: 'a', value: 2, doubled: 4 })
    } finally {
      after.close()
      await Dexie.delete(name)
    }
  })
})
