import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { db } from '../../src/db/db.ts'
import { getActive, listActive, softDeleteRecord, writeRecord } from '../../src/db/repo.ts'
import { newId } from '../../src/lib/id.ts'
import { CardSchema, EntrySchema } from '../../src/shared/index.ts'
import { makeCard, makeEntry, makeTopic } from '../factories.ts'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('newId', () => {
  it('returns UUIDs', () => {
    expect(z.uuid().safeParse(newId()).success).toBe(true)
    expect(newId()).not.toBe(newId())
  })
})

describe('writeRecord', () => {
  it('stamps updatedAt and stores the record', async () => {
    const saved = await writeRecord('topics', makeTopic({ updatedAt: 0 }), { now: 1_000 })
    expect(saved.updatedAt).toBe(1_000)
    expect(await db.topics.get(saved.id)).toEqual(saved)
  })

  it('queues the record in the outbox', async () => {
    const saved = await writeRecord('topics', makeTopic(), { now: 1_000 })
    expect(await db.outbox.toArray()).toEqual([{ table: 'topics', id: saved.id, queuedAt: 1_000 }])
  })

  it('keeps a single outbox row per record, with the latest queue time', async () => {
    const saved = await writeRecord('topics', makeTopic(), { now: 1_000 })
    await writeRecord('topics', { ...saved, nameEs: 'En la oficina' }, { now: 2_000 })
    expect(await db.outbox.toArray()).toEqual([{ table: 'topics', id: saved.id, queuedAt: 2_000 }])
  })

  it('does not queue data that came from the server (enqueue: false)', async () => {
    await writeRecord('topics', makeTopic(), { enqueue: false })
    expect(await db.topics.count()).toBe(1)
    expect(await db.outbox.count()).toBe(0)
  })

  it('keeps the remote updatedAt when asked to', async () => {
    const saved = await writeRecord('topics', makeTopic({ updatedAt: 555 }), {
      keepUpdatedAt: true,
      enqueue: false,
    })
    expect(saved.updatedAt).toBe(555)
    expect((await db.topics.get(saved.id))?.updatedAt).toBe(555)
  })

  it('round-trips nested records through IndexedDB', async () => {
    const entry = await writeRecord('entries', makeEntry({ topicIds: ['t1', 't2'] }))
    const card = await writeRecord('cards', makeCard({ entryId: entry.id }))
    expect(EntrySchema.safeParse(await db.entries.get(entry.id)).success).toBe(true)
    expect(CardSchema.safeParse(await db.cards.get(card.id)).success).toBe(true)
    // The multi-entry index finds the entry by any of its topics.
    expect((await db.entries.where('topicIds').equals('t2').toArray()).map((e) => e.id)).toEqual([entry.id])
  })
})

describe('softDeleteRecord', () => {
  it('keeps the record, marks it deleted and queues the deletion', async () => {
    const saved = await writeRecord('topics', makeTopic(), { now: 1_000 })
    expect(await softDeleteRecord('topics', saved.id, { now: 2_000 })).toBe(true)

    expect(await db.topics.get(saved.id)).toMatchObject({ deletedAt: 2_000, updatedAt: 2_000 })
    expect(await db.outbox.toArray()).toEqual([{ table: 'topics', id: saved.id, queuedAt: 2_000 }])
  })

  it('returns false and queues nothing when the record does not exist', async () => {
    expect(await softDeleteRecord('topics', newId())).toBe(false)
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('reading active records', () => {
  it('hides logically deleted records', async () => {
    const kept = await writeRecord('topics', makeTopic({ nameEs: 'Conservada' }))
    const removed = await writeRecord('topics', makeTopic({ nameEs: 'Borrada' }))
    await softDeleteRecord('topics', removed.id)

    expect(await getActive('topics', kept.id)).toBeDefined()
    expect(await getActive('topics', removed.id)).toBeUndefined()
    expect((await listActive('topics')).map((topic) => topic.id)).toEqual([kept.id])
  })
})
