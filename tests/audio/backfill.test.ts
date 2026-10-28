import { beforeEach, describe, expect, it, vi } from 'vitest'
import { backfillAudioUrls, entriesNeedingAudio } from '../../src/audio/backfill.ts'
import { db } from '../../src/db/db.ts'
import { writeRecord } from '../../src/db/repo.ts'
import type { LookupOutcome } from '../../src/lib/dictionary.ts'
import { makeEntry } from '../factories.ts'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const found = (audioUrl: string): LookupOutcome => ({
  kind: 'found',
  result: { ipa: '', audioUrl, senses: [], synonyms: [], antonyms: [] },
})

const add = (lemma: string, overrides = {}) =>
  writeRecord('entries', makeEntry({ lemma, lemmaKey: lemma, ...overrides }), { enqueue: false })

describe('entriesNeedingAudio', () => {
  it('lists active entries nobody has asked the dictionary about, newest first', async () => {
    await add('old', { createdAt: 1 })
    await add('new', { createdAt: 9 })
    await add('has-audio', { audioUrl: 'https://x/a-uk.mp3' })
    await add('checked', { audioCheckedAt: 5 })
    await add('waiting', { status: 'pending_ai' })
    await add('gone', { deletedAt: 3 })

    expect((await entriesNeedingAudio()).map((e) => e.lemma)).toEqual(['new', 'old'])
  })
})

describe('backfillAudioUrls', () => {
  it('stores a UK recording when the dictionary has one, and marks the entry as checked', async () => {
    const entry = await add('learnt')
    const lookup = vi.fn(async () => found('https://x/learnt-uk.mp3'))

    expect(await backfillAudioUrls({ lookup, now: () => 7_000 })).toBe(1)
    expect(await db.entries.get(entry.id)).toMatchObject({ audioUrl: 'https://x/learnt-uk.mp3', audioCheckedAt: 7_000 })
    // It is queued so the recording reaches the other device.
    expect(await db.outbox.get(['entries', entry.id])).toBeDefined()
  })

  it('marks a word as checked when there is no British recording or the dictionary does not know it', async () => {
    const without = await add('decide')
    const unknown = await add('knackered')
    const lookup = vi.fn(async (word: string): Promise<LookupOutcome> => (word === 'decide' ? found('') : { kind: 'missing' }))

    expect(await backfillAudioUrls({ lookup, now: () => 5 })).toBe(0)
    expect((await db.entries.get(without.id))?.audioUrl).toBeUndefined()
    expect((await db.entries.get(without.id))?.audioCheckedAt).toBe(5)
    expect((await db.entries.get(unknown.id))?.audioCheckedAt).toBe(5)
    expect((await entriesNeedingAudio()).length).toBe(0)
  })

  it('stops at the first unavailable answer and leaves the rest to try again later', async () => {
    await add('a', { createdAt: 3 })
    await add('b', { createdAt: 2 })
    await add('c', { createdAt: 1 })
    const lookup = vi
      .fn<(word: string) => Promise<LookupOutcome>>()
      .mockResolvedValueOnce({ kind: 'missing' })
      .mockResolvedValueOnce({ kind: 'unavailable' })

    await backfillAudioUrls({ lookup })

    expect(lookup).toHaveBeenCalledTimes(2)
    expect((await entriesNeedingAudio()).map((e) => e.lemma)).toEqual(['b', 'c'])
  })

  it('does not overwrite an entry that was edited or deleted while the lookup ran', async () => {
    const edited = await add('edited')
    const deleted = await add('deleted', { createdAt: 0 })
    const lookup = vi.fn(async (word: string): Promise<LookupOutcome> => {
      if (word === 'edited') await db.entries.put({ ...edited, audioUrl: 'https://x/mine-uk.mp3' })
      else await db.entries.put({ ...deleted, deletedAt: 9 })
      return found('https://x/other-uk.mp3')
    })

    expect(await backfillAudioUrls({ lookup })).toBe(0)
    expect((await db.entries.get(edited.id))?.audioUrl).toBe('https://x/mine-uk.mp3')
    expect((await db.entries.get(deleted.id))?.audioUrl).toBeUndefined()
  })

  it('respects the limit', async () => {
    for (let i = 0; i < 5; i += 1) await add(`w${i}`, { createdAt: i })
    const lookup = vi.fn(async () => ({ kind: 'missing' }) as LookupOutcome)

    await backfillAudioUrls({ lookup, limit: 2 })

    expect(lookup).toHaveBeenCalledTimes(2)
  })
})
