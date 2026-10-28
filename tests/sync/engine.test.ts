import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../src/db/db.ts'
import { softDeleteRecord, writeRecord } from '../../src/db/repo.ts'
import { SEED_PREFIX } from '../../src/dev/seed.ts'
import { loadDeviceSettings, saveDeviceSettings } from '../../src/db/settings.ts'
import { createMemoryStore } from '../../src/server/sync/memoryStore.ts'
import { handleSyncRequest } from '../../src/server/sync/handler.ts'
import { SYNC_LIMITS, type SyncRow } from '../../src/shared/index.ts'
import { SyncError } from '../../src/sync/client.ts'
import { runSync } from '../../src/sync/engine.ts'
import { LOCAL_ONLY_ID_PREFIX, nextPushBatch, settleBatch } from '../../src/sync/outbox.ts'
import { makeCard, makeEntry, makeLog, makeSource, makeTopic } from '../factories.ts'

const SECRET = 'test-secret-value'

/** The real server handler on top of an in-memory store, reachable through `fetch`. */
function server() {
  const store = createMemoryStore()
  const requests: { action: string; cursor?: number; records?: number }[] = []
  const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { action: string; cursor?: number; records?: unknown[] }
    const entry: { action: string; cursor?: number; records?: number } = { action: body.action }
    if (body.cursor !== undefined) entry.cursor = body.cursor
    if (body.records) entry.records = body.records.length
    requests.push(entry)
    return handleSyncRequest(new Request('http://localhost/api/sync', init), {
      env: { APP_SECRET: SECRET, DATABASE_URL: 'postgres://test' },
      createStore: () => store,
    })
  })
  return { store, fetchImpl: fetchImpl as unknown as typeof fetch, requests, calls: fetchImpl }
}

async function wipeDevice() {
  await db.delete()
  await db.open()
  await saveDeviceSettings({ appSecret: SECRET })
}

beforeEach(wipeDevice)

describe('runSync: access', () => {
  it('needs the secret', async () => {
    await saveDeviceSettings({ appSecret: '  ' })
    await expect(runSync({ fetchImpl: server().fetchImpl })).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('stops with a permanent error when the secret is wrong', async () => {
    await saveDeviceSettings({ appSecret: 'wrong' })
    await writeRecord('topics', makeTopic())
    const error = await runSync({ fetchImpl: server().fetchImpl }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(SyncError)
    expect(error).toMatchObject({ code: 'unauthorized', temporary: false })
    expect(await db.outbox.count()).toBe(1)
    expect((await loadDeviceSettings()).lastSyncOkAt).toBeUndefined()
  })
})

describe('runSync: push', () => {
  it('uploads what is in the outbox and empties it', async () => {
    const { store, fetchImpl } = server()
    const entry = await writeRecord('entries', makeEntry())
    const card = await writeRecord('cards', makeCard({ entryId: entry.id }))

    const report = await runSync({ fetchImpl })

    expect(report.pushed).toBe(2)
    expect(await db.outbox.count()).toBe(0)
    expect([...store.rows.values()].map((r) => r.id).sort()).toEqual([entry.id, card.id].sort())
  })

  it('uploads everything the first time, even records that were never queued', async () => {
    const { store, fetchImpl } = server()
    await writeRecord('entries', makeEntry(), { enqueue: false })
    await writeRecord('topics', makeTopic(), { enqueue: false })
    expect(await db.outbox.count()).toBe(0)

    await runSync({ fetchImpl })
    expect(store.rows.size).toBe(2)
  })

  it('does not queue everything again on later runs', async () => {
    const { store, fetchImpl } = server()
    await runSync({ fetchImpl })
    await writeRecord('topics', makeTopic(), { enqueue: false })
    await runSync({ fetchImpl })
    expect(store.rows.size).toBe(0)
  })

  it('never uploads development test data', async () => {
    const { store, fetchImpl } = server()
    await writeRecord('entries', makeEntry({ id: `${LOCAL_ONLY_ID_PREFIX}1` }))
    const real = await writeRecord('entries', makeEntry())
    await runSync({ fetchImpl })
    expect([...store.rows.values()].map((r) => r.id)).toEqual([real.id])
    expect(await db.outbox.count()).toBe(0)
  })

  it('uses the same prefix as the development seed', () => {
    expect(LOCAL_ONLY_ID_PREFIX).toBe(SEED_PREFIX)
  })

  it('sends batches of at most 500 records', async () => {
    const { store, requests, fetchImpl } = server()
    for (let i = 0; i < SYNC_LIMITS.pushRecords + 20; i += 1) await writeRecord('logs', makeLog({ at: i }))
    await runSync({ fetchImpl })
    const pushes = requests.filter((r) => r.action === 'push').map((r) => r.records)
    expect(pushes).toEqual([500, 20])
    expect(store.rows.size).toBe(520)
  })

  it('keeps a batch under about 1 MB', async () => {
    const { requests, fetchImpl } = server()
    for (let i = 0; i < 5; i += 1) await writeRecord('entries', makeEntry({ learnerNote: 'x'.repeat(250_000) }))
    await runSync({ fetchImpl })
    const pushes = requests.filter((r) => r.action === 'push').map((r) => r.records)
    expect(pushes).toEqual([3, 2])
  })

  it('leaves the outbox alone when the connection fails, and carries on later', async () => {
    const { store, fetchImpl } = server()
    await writeRecord('topics', makeTopic())
    const offline = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))

    const error = await runSync({ fetchImpl: offline as unknown as typeof fetch }).catch((e: unknown) => e)
    expect(error).toMatchObject({ code: 'network', temporary: true })
    expect(await db.outbox.count()).toBe(1)
    expect((await loadDeviceSettings()).lastSyncOkAt).toBeUndefined()

    await runSync({ fetchImpl })
    expect(await db.outbox.count()).toBe(0)
    expect(store.rows.size).toBe(1)
  })

  it('drops records the server refuses so they do not block the rest', async () => {
    const { store, fetchImpl } = server()
    await writeRecord('topics', makeTopic({ nameEs: '' }))
    const good = await writeRecord('topics', makeTopic())
    const report = await runSync({ fetchImpl })
    expect(report.rejected).toBe(1)
    expect(await db.outbox.count()).toBe(0)
    expect([...store.rows.values()].map((r) => r.id)).toEqual([good.id])
  })
})

describe('outbox: changes made while a batch is on its way', () => {
  it('only removes the records that did not change during the upload', async () => {
    const topic = await writeRecord('topics', makeTopic({ nameEs: 'uno' }), { now: 1_000 })
    const other = await writeRecord('topics', makeTopic(), { now: 1_000 })

    const batch = await nextPushBatch()
    expect(batch?.rows).toHaveLength(2)
    // The user edits one of them while the request is going.
    await writeRecord('topics', { ...topic, nameEs: 'dos' }, { now: 2_000 })
    await settleBatch(batch?.sent ?? [])

    expect(await db.outbox.toArray()).toEqual([{ table: 'topics', id: topic.id, queuedAt: 2_000 }])
    expect(await db.topics.get(other.id)).toBeDefined()
  })

  it('uploads the edit made during a run before it finishes', async () => {
    const { store, fetchImpl } = server()
    const topic = await writeRecord('topics', makeTopic({ nameEs: 'uno' }))
    let edited = false
    const editing = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const response = await fetchImpl(url, init)
      if (!edited && (JSON.parse(String(init?.body)) as { action: string }).action === 'push') {
        edited = true
        await writeRecord('topics', { ...topic, nameEs: 'dos' }, { now: Date.now() + 5 })
      }
      return response
    })

    await runSync({ fetchImpl: editing as unknown as typeof fetch })

    expect(await db.outbox.count()).toBe(0)
    expect([...store.rows.values()][0]?.data).toMatchObject({ nameEs: 'dos' })
  })
})

describe('runSync: pull', () => {
  it('applies what the server has, without queueing it again', async () => {
    const { store, fetchImpl } = server()
    const entry = makeEntry({ updatedAt: 100 })
    await store.upsert([{ table: 'entries', id: entry.id, data: entry, updatedAt: 100, deleted: false }])

    const report = await runSync({ fetchImpl })

    expect(report).toMatchObject({ pulled: 1, applied: 1 })
    expect(await db.entries.get(entry.id)).toEqual(entry)
    expect(await db.outbox.count()).toBe(0)
    const settings = await loadDeviceSettings()
    expect(settings.syncCursor).toBe(1)
    expect(settings.lastSyncOkAt).toBeDefined()
  })

  it('reads pages until it has everything', async () => {
    const { store, requests, fetchImpl } = server()
    const topics = Array.from({ length: 7 }, (_, i) => makeTopic({ updatedAt: i + 1 }))
    await store.upsert(topics.map((t) => ({ table: 'topics' as const, id: t.id, data: t, updatedAt: t.updatedAt, deleted: false })))

    await runSync({ fetchImpl, pullLimit: 3 })

    expect(await db.topics.count()).toBe(7)
    expect(requests.filter((r) => r.action === 'pull').map((r) => r.cursor)).toEqual([0, 3, 6])
    expect((await loadDeviceSettings()).syncCursor).toBe(7)
  })

  it('goes a little back from the cursor each time, so a late commit is not missed', async () => {
    const { store, requests, fetchImpl } = server()
    const topics = Array.from({ length: 120 }, (_, i) => makeTopic({ updatedAt: i + 1 }))
    await store.upsert(topics.map((t) => ({ table: 'topics' as const, id: t.id, data: t, updatedAt: t.updatedAt, deleted: false })))
    await runSync({ fetchImpl })
    requests.length = 0

    await runSync({ fetchImpl })
    expect(requests.find((r) => r.action === 'pull')?.cursor).toBe(120 - SYNC_LIMITS.pullOverlap)
    // Records read again change nothing.
    expect(await db.topics.count()).toBe(120)
    expect((await loadDeviceSettings()).syncCursor).toBe(120)
  })

  it('ignores received records that are not valid', async () => {
    const { store, fetchImpl } = server()
    await store.upsert([{ table: 'topics', id: 'bad', data: { id: 'bad' }, updatedAt: 5, deleted: false }])
    const good = makeTopic({ updatedAt: 6 })
    await store.upsert([{ table: 'topics', id: good.id, data: good, updatedAt: 6, deleted: false }])

    const report = await runSync({ fetchImpl })
    expect(report).toMatchObject({ invalid: 1, applied: 1 })
    expect(await db.topics.count()).toBe(1)
  })
})

describe('conflicts: the last write wins', () => {
  it('keeps a newer local record and sends it to the server', async () => {
    const { store, fetchImpl } = server()
    const topic = makeTopic({ nameEs: 'remoto', updatedAt: 100 })
    await store.upsert([{ table: 'topics', id: topic.id, data: topic, updatedAt: 100, deleted: false }])
    await writeRecord('topics', { ...topic, nameEs: 'local' }, { now: 200 })

    await runSync({ fetchImpl })

    expect((await db.topics.get(topic.id))?.nameEs).toBe('local')
    expect(store.rows.get(`topics:${topic.id}`)?.data).toMatchObject({ nameEs: 'local', updatedAt: 200 })
  })

  it('replaces an older local record with the remote one', async () => {
    const { store, fetchImpl } = server()
    const topic = makeTopic({ nameEs: 'remoto', updatedAt: 300 })
    await store.upsert([{ table: 'topics', id: topic.id, data: topic, updatedAt: 300, deleted: false }])
    await writeRecord('topics', { ...topic, nameEs: 'local' }, { now: 200 })

    await runSync({ fetchImpl })

    expect((await db.topics.get(topic.id))?.nameEs).toBe('remoto')
    expect(store.rows.get(`topics:${topic.id}`)?.data).toMatchObject({ nameEs: 'remoto' })
    // The local edit lost, so there is nothing left to upload.
    expect(await db.outbox.count()).toBe(0)
  })

  it('resolves the same card reviewed on two devices without losing either review', async () => {
    const { store, fetchImpl } = server()
    const card = makeCard({ updatedAt: 1 })
    // Device A reviewed it at t = 500, device B at t = 900; B reached the server first.
    const logA = makeLog({ cardId: card.id, at: 500, updatedAt: 500 })
    const logB = makeLog({ cardId: card.id, at: 900, updatedAt: 900 })
    const cardB = { ...card, stats: { ...card.stats, seen: 1 }, updatedAt: 900 }
    await store.upsert([
      { table: 'cards', id: card.id, data: cardB, updatedAt: 900, deleted: false },
      { table: 'logs', id: logB.id, data: logB, updatedAt: 900, deleted: false },
    ])
    await writeRecord('cards', { ...card, stats: { ...card.stats, seen: 2 } }, { now: 500 })
    await writeRecord('logs', logA, { now: 500 })

    await runSync({ fetchImpl })

    // The card state is the latest answer; the history keeps both.
    expect((await db.cards.get(card.id))?.updatedAt).toBe(900)
    expect(await db.logs.count()).toBe(2)
    expect([...store.rows.values()].filter((r) => r.table === 'logs')).toHaveLength(2)
  })
})

describe('deletions travel as records', () => {
  it('a logical deletion reaches a device that has the record', async () => {
    const { fetchImpl } = server()
    const entry = await writeRecord('entries', makeEntry(), { now: 100 })
    await runSync({ fetchImpl }) // this device now has it on the server

    // The same data on a second device...
    const copy = await db.entries.get(entry.id)
    await wipeDevice()
    await writeRecord('entries', copy ?? entry, { keepUpdatedAt: true, enqueue: false })
    await runSync({ fetchImpl })
    // ...which deletes it,
    expect(await softDeleteRecord('entries', entry.id, { now: 500 })).toBe(true)
    await runSync({ fetchImpl })

    // and the first device receives the deletion.
    await wipeDevice()
    await writeRecord('entries', entry, { keepUpdatedAt: true, enqueue: false })
    await runSync({ fetchImpl })
    expect((await db.entries.get(entry.id))?.deletedAt).toBe(500)
    expect(await db.outbox.count()).toBe(0)
  })

  it('a new device gets deleted records as deleted, not missing', async () => {
    const { fetchImpl } = server()
    const source = await writeRecord('sources', makeSource(), { now: 100 })
    await softDeleteRecord('sources', source.id, { now: 200 })
    await runSync({ fetchImpl })

    await wipeDevice()
    await runSync({ fetchImpl })
    expect(await db.sources.get(source.id)).toMatchObject({ deletedAt: 200, updatedAt: 200 })
  })
})

describe('runSync: a device joining and a server that was emptied', () => {
  it('a second device ends up with the same data, and merges what it had', async () => {
    const { store, fetchImpl } = server()
    const phoneWord = await writeRecord('entries', makeEntry({ lemma: 'run', lemmaKey: 'run' }))
    await runSync({ fetchImpl })

    // The PC: empty database, then its own word.
    await wipeDevice()
    const pcWord = await writeRecord('entries', makeEntry({ lemma: 'walk', lemmaKey: 'walk' }))
    await runSync({ fetchImpl })

    expect((await db.entries.toArray()).map((e) => e.lemma).sort()).toEqual(['run', 'walk'])
    expect(store.rows.size).toBe(2)
    expect(await db.entries.get(phoneWord.id)).toBeDefined()
    expect(await db.entries.get(pcWord.id)).toBeDefined()
  })

  it('uploads everything again when the server has fewer changes than the cursor says', async () => {
    const { store, fetchImpl } = server()
    for (let i = 0; i < 3; i += 1) await writeRecord('topics', makeTopic())
    await runSync({ fetchImpl })
    expect((await loadDeviceSettings()).syncCursor).toBe(3)

    store.reset() // the database was emptied or replaced
    await runSync({ fetchImpl })

    expect(store.rows.size).toBe(3)
    expect(await db.outbox.count()).toBe(0)
    expect((await loadDeviceSettings()).syncCursor).toBe(3)
  })
})

describe('wire format', () => {
  it('sends the records as plain JSON rows', async () => {
    const { calls, fetchImpl } = server()
    const topic = await writeRecord('topics', makeTopic())
    await runSync({ fetchImpl })
    const init = calls.mock.calls[0]?.[1]
    const body = JSON.parse(String(init?.body)) as { action: string; records: SyncRow[] }
    expect(body).toMatchObject({ action: 'push', records: [{ table: 'topics', data: { id: topic.id } }] })
    expect(new Headers(init?.headers).get('x-app-secret')).toBe(SECRET)
  })
})
