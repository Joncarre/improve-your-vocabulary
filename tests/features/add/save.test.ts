import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../src/db/db.ts'
import { listActive, softDeleteRecord } from '../../../src/db/repo.ts'
import { buildDraftFromAi, emptySense, type EntryDraft } from '../../../src/features/add/draft.ts'
import {
  addContextToExisting,
  findActiveEntryByKey,
  findNewSense,
  getMarathonDefaults,
  listSources,
  loadTopicsForPrompt,
  saveNewEntry,
} from '../../../src/features/add/save.ts'
import { TOPIC_COLORS } from '../../../src/lib/palette.ts'
import { CardSchema, EntrySchema } from '../../../src/shared/index.ts'
import { makeEnrichOutput } from '../../factories.ts'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const draftFor = (typed = 'went', overrides: Partial<ReturnType<typeof makeEnrichOutput>> = {}): EntryDraft =>
  buildDraftFromAi(makeEnrichOutput(overrides), typed)

const HOUR = 60 * 60 * 1000

describe('saveNewEntry', () => {
  it('creates the entry with its sentence, source and topic, plus two cards', async () => {
    const entry = await saveNewEntry({
      draft: draftFor(),
      status: 'active',
      sentence: 'We went to the pub after work.',
      sourceTitle: 'Peaky Blinders',
      detail: 'T2 E5',
      now: 5_000,
    })

    expect(EntrySchema.safeParse(await db.entries.get(entry.id)).success).toBe(true)
    expect(entry).toMatchObject({ lemma: 'go', lemmaKey: 'go', seenForm: 'went', status: 'active', createdAt: 5_000 })
    expect(entry.contexts).toHaveLength(1)
    expect(entry.contexts[0]).toMatchObject({
      sentence: 'We went to the pub after work.',
      translationEs: 'Fuimos al pub después del trabajo.',
      surface: 'went',
      detail: 'T2 E5',
      addedAt: 5_000,
    })

    const [source] = await listActive('sources')
    expect(source).toMatchObject({ title: 'Peaky Blinders', type: 'other', lastUsedAt: 5_000 })
    expect(entry.contexts[0]?.sourceId).toBe(source?.id)

    const [topic] = await listActive('topics')
    expect(topic).toMatchObject({ nameEs: 'En el pub', emoji: '🍺' })
    expect(TOPIC_COLORS).toContain(topic?.color)
    expect(entry.topicIds).toEqual([topic?.id])
  })

  it('creates a ready recognition card and a locked production card', async () => {
    const entry = await saveNewEntry({ draft: draftFor(), status: 'active', now: 7_000 })
    const cards = await db.cards.where('entryId').equals(entry.id).toArray()

    expect(cards.map((card) => card.type).sort()).toEqual(['production', 'recognition'])
    for (const card of cards) {
      expect(CardSchema.safeParse(card).success).toBe(true)
      expect(card).toMatchObject({ due: 7_000, suspended: false, fsrs: { state: 0, reps: 0 } })
    }
    expect(cards.find((card) => card.type === 'recognition')?.unlocked).toBe(true)
    expect(cards.find((card) => card.type === 'production')?.unlocked).toBe(false)
  })

  it('queues every record it wrote for sync', async () => {
    const entry = await saveNewEntry({ draft: draftFor(), status: 'active', sentence: 'We went.', sourceTitle: 'Show' })
    const queued = (await db.outbox.toArray()).map((item) => item.table).sort()

    expect(queued).toEqual(['cards', 'cards', 'entries', 'sources', 'topics'])
    expect((await db.outbox.get(['entries', entry.id]))?.id).toBe(entry.id)
  })

  it('saves without a sentence or a source', async () => {
    const entry = await saveNewEntry({ draft: draftFor('go'), status: 'active' })

    expect(entry.contexts).toEqual([])
    expect(await db.sources.count()).toBe(0)
    expect(entry.seenForm).toBeUndefined()
  })

  it('drops senses that say nothing and keeps the pending status when asked', async () => {
    const draft = { ...draftFor(), senses: [emptySense('verb'), { ...emptySense('verb'), meaningEs: 'ir' }] }
    const entry = await saveNewEntry({ draft, status: 'pending_ai' })

    expect(entry.senses.map((sense) => sense.meaningEs)).toEqual(['ir'])
    expect(entry.status).toBe('pending_ai')
  })

  it('reuses a source whatever its capitalisation, and refreshes when it was last used', async () => {
    await saveNewEntry({ draft: draftFor('a', { lemma: 'a' }), status: 'active', sourceTitle: 'Peaky Blinders', now: 1_000 })
    await saveNewEntry({ draft: draftFor('b', { lemma: 'b' }), status: 'active', sourceTitle: ' peaky blinders ', now: 9_000 })

    const sources = await listActive('sources')
    expect(sources).toHaveLength(1)
    expect(sources[0]?.lastUsedAt).toBe(9_000)
    expect(sources[0]?.title).toBe('Peaky Blinders')
  })

  it('reuses an existing topic with the same name instead of creating another', async () => {
    await saveNewEntry({ draft: draftFor('a', { lemma: 'a' }), status: 'active' })
    await saveNewEntry({ draft: draftFor('b', { lemma: 'b', newTopic: { nameEs: ' EN EL PUB ', emoji: '🍻' } }), status: 'active' })

    expect(await listActive('topics')).toHaveLength(1)
  })

  it('gives each new topic a different pastel colour and keeps at most two topics per entry', async () => {
    await saveNewEntry({ draft: draftFor('a', { lemma: 'a', newTopic: { nameEs: 'Uno', emoji: '1' } }), status: 'active' })
    await saveNewEntry({ draft: draftFor('b', { lemma: 'b', newTopic: { nameEs: 'Dos', emoji: '2' } }), status: 'active' })
    const colours = (await listActive('topics')).map((topic) => topic.color)
    expect(new Set(colours).size).toBe(2)

    const crowded = await saveNewEntry({
      draft: { ...draftFor('c', { lemma: 'c' }), topicIds: ['t1', 't2'], newTopic: { nameEs: 'Tres', emoji: '3' } },
      status: 'active',
    })
    expect(crowded.topicIds).toEqual(['t1', 't2'])
    expect(await listActive('topics')).toHaveLength(2)
  })
})

describe('finding entries', () => {
  it('finds an active entry by its key and ignores deleted ones', async () => {
    const entry = await saveNewEntry({ draft: draftFor(), status: 'active' })

    expect((await findActiveEntryByKey('go'))?.id).toBe(entry.id)
    expect(await findActiveEntryByKey('stop')).toBeUndefined()
    expect(await findActiveEntryByKey('')).toBeUndefined()

    await softDeleteRecord('entries', entry.id)
    expect(await findActiveEntryByKey('go')).toBeUndefined()
  })

  it('lists sources by recency and topics for the AI prompt', async () => {
    await saveNewEntry({ draft: draftFor('a', { lemma: 'a' }), status: 'active', sourceTitle: 'Old', now: 1_000 })
    await saveNewEntry({ draft: draftFor('b', { lemma: 'b', newTopic: null }), status: 'active', sourceTitle: 'New', now: 2_000 })

    expect((await listSources()).map((source) => source.title)).toEqual(['New', 'Old'])
    expect(await loadTopicsForPrompt()).toEqual([{ id: expect.any(String), nameEs: 'En el pub' }])
  })
})

describe('"Ya la tienes": adding to an existing entry', () => {
  it('adds the sentence as a new context without duplicating cards', async () => {
    const entry = await saveNewEntry({ draft: draftFor(), status: 'active', sentence: 'We went home.', now: 1_000 })
    const result = await addContextToExisting(
      entry.id,
      { sentence: 'She went to Paris.', translationEs: 'Fue a París.', surface: 'went', sourceTitle: 'Dark', detail: 'min 34' },
      2_000,
    )

    expect(result).toMatchObject({ contextAdded: true, senseAdded: false })
    expect(result.entry.contexts.map((context) => context.sentence)).toEqual(['We went home.', 'She went to Paris.'])
    expect(result.entry.contexts[1]).toMatchObject({ detail: 'min 34', addedAt: 2_000 })
    expect(await db.cards.where('entryId').equals(entry.id).count()).toBe(2)
    expect(await db.entries.count()).toBe(1)
  })

  it('does not add the same sentence twice', async () => {
    const entry = await saveNewEntry({ draft: draftFor(), status: 'active', sentence: 'We went home.' })
    const result = await addContextToExisting(entry.id, { sentence: ' we went home! ' })

    expect(result.contextAdded).toBe(false)
    expect((await db.entries.get(entry.id))?.contexts).toHaveLength(1)
  })

  it('adds a sense the sentence uses that the entry lacks, without claiming it is the first', async () => {
    const entry = await saveNewEntry({ draft: draftFor(), status: 'active' })
    const newSense = { ...emptySense('verb'), meaningEs: 'funcionar', definitionEn: 'to work properly', matchesContext: true }
    const result = await addContextToExisting(entry.id, { sentence: 'Does this radio still go?', newSense })

    expect(result).toMatchObject({ contextAdded: true, senseAdded: true })
    expect(result.entry.senses.at(-1)).toMatchObject({ meaningEs: 'funcionar', matchesContext: false })
  })

  it('refuses to touch an entry that no longer exists', async () => {
    await expect(addContextToExisting('missing', { sentence: 'Hello.' })).rejects.toThrow()
  })
})

describe('findNewSense', () => {
  it('is undefined when an existing sense already covers it (same part of speech, similar meaning)', async () => {
    const entry = await saveNewEntry({ draft: draftFor(), status: 'active' })
    const draft = { ...draftFor(), senses: [{ ...emptySense('verb'), meaningEs: 'Ir a un sitio', matchesContext: true }] }

    expect(findNewSense(entry, draft)).toBeUndefined()
  })

  it('returns the sense that matches the sentence when the entry does not have it', async () => {
    const entry = await saveNewEntry({ draft: draftFor(), status: 'active' })
    const fresh = { ...emptySense('verb'), meaningEs: 'estropearse', matchesContext: true }

    expect(findNewSense(entry, { ...draftFor(), senses: [fresh] })).toBe(fresh)
  })

  it('does not treat the same meaning with another part of speech as known', async () => {
    const entry = await saveNewEntry({ draft: draftFor(), status: 'active' })
    const asNoun = { ...emptySense('noun'), meaningEs: 'ir', matchesContext: true }

    expect(findNewSense(entry, { ...draftFor(), senses: [asNoun] })).toBe(asNoun)
  })

  it('is undefined when no sense matches the sentence', async () => {
    const entry = await saveNewEntry({ draft: draftFor(), status: 'active' })
    expect(findNewSense(entry, { ...draftFor(), senses: [{ ...emptySense('verb'), meaningEs: 'otro' }] })).toBeUndefined()
  })
})

describe('getMarathonDefaults', () => {
  it('proposes the source and detail of a word added less than 3 hours ago', async () => {
    await saveNewEntry({ draft: draftFor(), status: 'active', sentence: 'We went.', sourceTitle: 'Peaky Blinders', detail: 'T2 E5', now: 10 * HOUR })

    expect(await getMarathonDefaults(10 * HOUR + 25 * 60_000)).toEqual({
      sourceTitle: 'Peaky Blinders',
      detail: 'T2 E5',
      minutesAgo: 25,
    })
  })

  it('stops proposing it after 3 hours', async () => {
    await saveNewEntry({ draft: draftFor(), status: 'active', sentence: 'We went.', sourceTitle: 'Peaky Blinders', now: 10 * HOUR })

    expect(await getMarathonDefaults(13 * HOUR)).toBeUndefined()
  })

  it('has nothing to propose without a recent word that had a source', async () => {
    expect(await getMarathonDefaults()).toBeUndefined()
    await saveNewEntry({ draft: draftFor(), status: 'active', sentence: 'No source.', now: 10 * HOUR })
    expect(await getMarathonDefaults(10 * HOUR + 60_000)).toBeUndefined()
  })

  it('uses the most recent context even when it was added to an older entry', async () => {
    const first = await saveNewEntry({ draft: draftFor('a', { lemma: 'a' }), status: 'active', sentence: 'A.', sourceTitle: 'Old show', detail: 'x', now: 10 * HOUR })
    await saveNewEntry({ draft: draftFor('b', { lemma: 'b' }), status: 'active', sentence: 'B.', sourceTitle: 'Old show', detail: 'y', now: 10 * HOUR + 1_000 })
    await addContextToExisting(first.id, { sentence: 'A again.', sourceTitle: 'New show', detail: 'z' }, 10 * HOUR + 60_000)

    expect(await getMarathonDefaults(10 * HOUR + 120_000)).toMatchObject({ sourceTitle: 'New show', detail: 'z' })
  })
})
