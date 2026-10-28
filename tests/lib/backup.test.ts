import { beforeEach, describe, expect, it } from 'vitest'
import { applyRecords, replaceAllRecords } from '../../src/db/bulk.ts'
import { db } from '../../src/db/db.ts'
import { softDeleteRecord, writeRecord } from '../../src/db/repo.ts'
import { saveSharedSettings } from '../../src/db/settings.ts'
import {
  BACKUP_APP,
  BACKUP_SCHEMA_VERSION,
  backupFileName,
  backupRecords,
  buildBackup,
  countBackup,
  parseBackup,
} from '../../src/lib/backup.ts'
import { makeCard, makeEntry, makeLog, makeSource, makeTopic } from '../factories.ts'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

async function fillDevice() {
  const topic = await writeRecord('topics', makeTopic(), { now: 100 })
  const source = await writeRecord('sources', makeSource(), { now: 100 })
  const entry = await writeRecord('entries', makeEntry({ topicIds: [topic.id] }), { now: 100 })
  const card = await writeRecord('cards', makeCard({ entryId: entry.id }), { now: 100 })
  const log = await writeRecord('logs', makeLog({ cardId: card.id, entryId: entry.id }), { now: 100 })
  await saveSharedSettings({ newPerDay: 7 })
  return { topic, source, entry, card, log }
}

describe('export', () => {
  it('holds every synced table with the version and the date', async () => {
    const { entry, card, log } = await fillDevice()
    const backup = await buildBackup(5_000)
    expect(backup).toMatchObject({ app: BACKUP_APP, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: 5_000 })
    expect(Object.keys(backup.tables).sort()).toEqual(['cards', 'entries', 'games', 'logs', 'sharedSettings', 'sources', 'stories', 'topics'])
    expect(backup.tables.entries.map((e) => e.id)).toEqual([entry.id])
    expect(backup.tables.cards.map((c) => c.id)).toEqual([card.id])
    expect(backup.tables.logs.map((l) => l.id)).toEqual([log.id])
    expect(backup.tables.sharedSettings[0]?.newPerDay).toBe(7)
  })

  it('does not include the device settings, which hold the secret', async () => {
    await db.deviceSettings.put({
      id: 'device',
      autoPlayAudio: true,
      voiceRate: 1,
      appSecret: 'super-secret-value',
      syncCursor: 0,
      onboardingDone: true,
      installGuideDismissed: false,
    })
    expect(JSON.stringify(await buildBackup())).not.toContain('super-secret-value')
  })

  it('keeps deleted records, so a merge can keep the deletion', async () => {
    const { entry } = await fillDevice()
    await softDeleteRecord('entries', entry.id, { now: 900 })
    const backup = await buildBackup()
    expect(backup.tables.entries[0]?.deletedAt).toBe(900)
    expect(countBackup(backup).words).toBe(0)
  })

  it('names the file after the date', () => {
    expect(backupFileName(Date.UTC(2026, 9, 28, 12))).toBe('vocabulario-copia-2026-10-28.json')
  })
})

describe('import: reading the file', () => {
  it('accepts what export wrote, through JSON', async () => {
    await fillDevice()
    const text = JSON.stringify(await buildBackup())
    const parsed = parseBackup(text)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(countBackup(parsed.backup)).toEqual({ words: 1, cards: 1, reviews: 1, sources: 1, topics: 1, games: 0 })
  })

  it.each([
    ['text that is not JSON', 'esto no es json', 'JSON válido'],
    ['a JSON of another app', JSON.stringify({ hello: 'world' }), 'no es una copia de seguridad de esta app'],
    ['a newer format', JSON.stringify({ app: BACKUP_APP, schemaVersion: BACKUP_SCHEMA_VERSION + 1 }), 'versión más nueva'],
  ])('refuses %s', (_label, text, message) => {
    const parsed = parseBackup(text)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.message).toContain(message)
  })

  it('refuses a damaged file and says where, importing nothing', async () => {
    await fillDevice()
    const backup = JSON.parse(JSON.stringify(await buildBackup())) as { tables: { entries: { lemma?: string }[] } }
    delete backup.tables.entries[0]?.lemma
    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.message).toContain('tables.entries.0.lemma')
  })
})

describe('export → delete → import', () => {
  it('restores everything after the data is wiped', async () => {
    const before = await fillDevice()
    const text = JSON.stringify(await buildBackup())

    await db.delete()
    await db.open()
    expect(await db.entries.count()).toBe(0)

    const parsed = parseBackup(text)
    if (!parsed.ok) throw new Error(parsed.message)
    const result = await applyRecords(backupRecords(parsed.backup), { enqueue: true })

    expect(result.applied).toBe(6) // topic, source, entry, card, log, settings
    expect(await db.entries.get(before.entry.id)).toEqual(before.entry)
    expect(await db.cards.get(before.card.id)).toEqual(before.card)
    expect(await db.logs.get(before.log.id)).toEqual(before.log)
    expect(await db.topics.get(before.topic.id)).toEqual(before.topic)
    expect((await db.sharedSettings.get('shared'))?.newPerDay).toBe(7)
    // What came back is also queued, so it reaches the server.
    expect(await db.outbox.count()).toBe(6)
  })
})

describe('merge', () => {
  it('keeps the newer version of a record found in both places', async () => {
    const { topic } = await fillDevice()
    const fromFile = [{ table: 'topics' as const, record: { ...topic, nameEs: 'del archivo', updatedAt: 500 } }]
    expect((await applyRecords(fromFile, { enqueue: true })).applied).toBe(1)
    expect((await db.topics.get(topic.id))?.nameEs).toBe('del archivo')

    const older = [{ table: 'topics' as const, record: { ...topic, nameEs: 'antiguo', updatedAt: 200 } }]
    expect(await applyRecords(older, { enqueue: true })).toEqual({ applied: 0, skipped: 1 })
    expect((await db.topics.get(topic.id))?.nameEs).toBe('del archivo')
  })

  it('does not bring back a word deleted after the copy was made', async () => {
    const { entry } = await fillDevice()
    const backup = await buildBackup()
    await softDeleteRecord('entries', entry.id, { now: 9_000 })

    await applyRecords(backupRecords(backup), { enqueue: true })

    expect((await db.entries.get(entry.id))?.deletedAt).toBe(9_000)
  })

  it('adds what is missing and leaves the rest alone', async () => {
    const { entry } = await fillDevice()
    const extra = makeEntry({ lemma: 'walk', lemmaKey: 'walk', updatedAt: 50 })
    await applyRecords([{ table: 'entries', record: extra }], { enqueue: true })
    expect((await db.entries.toArray()).map((e) => e.id).sort()).toEqual([entry.id, extra.id].sort())
  })

  it('applies the newest copy when a file repeats an id', async () => {
    const topic = makeTopic()
    await applyRecords(
      [
        { table: 'topics', record: { ...topic, nameEs: 'segundo', updatedAt: 20 } },
        { table: 'topics', record: { ...topic, nameEs: 'primero', updatedAt: 10 } },
      ],
      { enqueue: false },
    )
    expect((await db.topics.get(topic.id))?.nameEs).toBe('segundo')
  })

  it('does not queue what came from the server, and drops the stale local upload', async () => {
    const topic = await writeRecord('topics', makeTopic({ nameEs: 'local' }), { now: 100 })
    expect(await db.outbox.count()).toBe(1)
    await applyRecords([{ table: 'topics', record: { ...topic, nameEs: 'remoto', updatedAt: 300 } }], { enqueue: false })
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('replace all (B10)', () => {
  it('makes the device hold exactly the file, deleting the rest logically', async () => {
    const { entry: kept } = await fillDevice()
    const backup = await buildBackup()
    // After the copy: a new word, and the first one edited.
    const added = await writeRecord('entries', makeEntry({ lemma: 'walk', lemmaKey: 'walk' }), { now: 400 })
    await writeRecord('entries', { ...kept, learnerNote: 'editada' }, { now: 400 })
    await db.outbox.clear()

    const result = await replaceAllRecords(backupRecords(backup), 1_000)

    expect(result.removed).toBe(1)
    expect(await db.entries.get(added.id)).toMatchObject({ deletedAt: 1_000, updatedAt: 1_000 })
    expect((await db.entries.get(kept.id))?.learnerNote).toBeUndefined()
    expect((await db.entries.get(kept.id))?.updatedAt).toBe(1_000)
  })

  it('stamps everything with the current time and queues it, so it wins over the server', async () => {
    const { entry } = await fillDevice()
    const backup = await buildBackup()
    await db.outbox.clear()

    await replaceAllRecords(backupRecords(backup), 7_000)

    expect((await db.entries.get(entry.id))?.updatedAt).toBe(7_000)
    const queued = await db.outbox.toArray()
    expect(queued.length).toBeGreaterThanOrEqual(6)
    expect(queued.every((item) => item.queuedAt === 7_000)).toBe(true)
  })

  it('brings back records that were deleted here but are in the file', async () => {
    const { entry } = await fillDevice()
    const backup = await buildBackup()
    await softDeleteRecord('entries', entry.id, { now: 9_000 })

    await replaceAllRecords(backupRecords(backup), 10_000)

    expect((await db.entries.get(entry.id))?.deletedAt).toBeUndefined()
  })

  it('leaves the current settings alone when the file has none', async () => {
    await saveSharedSettings({ newPerDay: 3 })
    const backup = await buildBackup()
    backup.tables.sharedSettings = []
    await replaceAllRecords(backupRecords(backup), 2_000)
    const settings = await db.sharedSettings.get('shared')
    expect(settings?.newPerDay).toBe(3)
    expect(settings?.deletedAt).toBeUndefined()
  })
})
