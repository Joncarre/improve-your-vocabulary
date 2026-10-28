import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiError, type requestEnrich } from '../../src/ai/client.ts'
import { applyEnrichToEntry, listPendingEntries, processPendingEntries } from '../../src/ai/pending.ts'
import { db } from '../../src/db/db.ts'
import { getActive, listActive } from '../../src/db/repo.ts'
import { buildDraftFromAi, buildDraftFromDictionary } from '../../src/features/add/draft.ts'
import { saveNewEntry } from '../../src/features/add/save.ts'
import { makeEnrichOutput } from '../factories.ts'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const savePending = (typed: string, sentence?: string, now = 1_000) =>
  saveNewEntry({ draft: buildDraftFromDictionary(typed, null), status: 'pending_ai', ...(sentence ? { sentence } : {}), now })

const saveActive = (typed: string, overrides = {}) => saveNewEntry({ draft: buildDraftFromAi(makeEnrichOutput(overrides), typed), status: 'active' })

describe('applyEnrichToEntry', () => {
  it('completes a pending entry: AI senses, forms and IPA, and the user data stays', async () => {
    const pending = await savePending('went', 'We went to the pub after work.')
    await db.outbox.clear()

    const outcome = await applyEnrichToEntry(pending, makeEnrichOutput(), 9_000)
    const entry = await db.entries.get(pending.id)

    expect(outcome).toBe('completed')
    expect(entry).toMatchObject({
      lemma: 'go',
      lemmaKey: 'go',
      seenForm: 'went',
      status: 'active',
      ipa: '/ɡəʊ/',
      createdAt: pending.createdAt,
      updatedAt: 9_000,
    })
    expect(entry?.senses.map((sense) => sense.meaningEs)).toEqual(['ir', 'turno'])
    expect(entry?.forms?.verb?.pastSimple).toEqual(['went'])
    expect(entry?.contexts).toHaveLength(1)
    expect(entry?.contexts[0]).toMatchObject({
      sentence: 'We went to the pub after work.',
      translationEs: 'Fuimos al pub después del trabajo.',
      surface: 'went',
    })
    // It is queued so the completed entry reaches the other device.
    expect((await db.outbox.toArray()).map((item) => item.table)).toContain('entries')
  })

  it('creates the proposed topic only when the user had none', async () => {
    const pending = await savePending('went')
    await applyEnrichToEntry(pending, makeEnrichOutput())

    expect((await listActive('topics')).map((topic) => topic.nameEs)).toEqual(['En el pub'])
    expect((await db.entries.get(pending.id))?.topicIds).toHaveLength(1)

    const other = await saveNewEntry({
      draft: { ...buildDraftFromDictionary('lorry', null), topicIds: ['mine'] },
      status: 'pending_ai',
    })
    await applyEnrichToEntry(other, makeEnrichOutput({ lemma: 'lorry', newTopic: { nameEs: 'Otro', emoji: '🚚' } }))
    expect((await db.entries.get(other.id))?.topicIds).toEqual(['mine'])
  })

  it('keeps the UK audio the dictionary had found', async () => {
    const pending = await saveNewEntry({
      draft: { ...buildDraftFromDictionary('learnt', null), audioUrl: 'https://x/learnt-uk.mp3' },
      status: 'pending_ai',
    })
    await applyEnrichToEntry(pending, makeEnrichOutput({ lemma: 'learnt' }))

    expect((await db.entries.get(pending.id))?.audioUrl).toBe('https://x/learnt-uk.mp3')
  })

  it('merges into the entry the user already had when the real lemma is not new', async () => {
    const existing = await saveActive('go')
    const pending = await savePending('went', 'We went home.')

    const outcome = await applyEnrichToEntry(pending, makeEnrichOutput(), 9_000)

    expect(outcome).toBe('merged')
    expect((await getActive('entries', existing.id))?.contexts.map((c) => c.sentence)).toEqual(['We went home.'])
    expect(await getActive('entries', pending.id)).toBeUndefined()
    const pendingCards = await db.cards.where('entryId').equals(pending.id).toArray()
    expect(pendingCards).toHaveLength(2)
    expect(pendingCards.every((card) => card.deletedAt === 9_000)).toBe(true)
    expect((await db.cards.where('entryId').equals(existing.id).toArray()).every((card) => card.deletedAt === undefined)).toBe(true)
  })

  it('does not copy a sentence the existing entry already has', async () => {
    const existing = await saveNewEntry({ draft: buildDraftFromAi(makeEnrichOutput(), 'go'), status: 'active', sentence: 'We went home.' })
    const pending = await savePending('went', 'we went home!')

    await applyEnrichToEntry(pending, makeEnrichOutput())

    expect((await getActive('entries', existing.id))?.contexts).toHaveLength(1)
  })
})

describe('processPendingEntries', () => {
  const answering = () => vi.fn<typeof requestEnrich>(async () => makeEnrichOutput())

  it('does nothing when no entry is waiting', async () => {
    const request = answering()
    expect(await processPendingEntries({ secret: 's', request })).toEqual({ completed: 0, merged: 0 })
    expect(request).not.toHaveBeenCalled()
  })

  it('completes the waiting entries oldest first, sending the sentence, source and topics', async () => {
    await saveActive('cheers', { lemma: 'cheers', newTopic: { nameEs: 'Bares', emoji: '🍻' } })
    const newer = await savePending('lorry', 'The lorry stopped.', 2_000)
    const older = await saveNewEntry({
      draft: buildDraftFromDictionary('knackered', null),
      status: 'pending_ai',
      sentence: "I'm knackered.",
      sourceTitle: 'Show',
      now: 1_000,
    })
    const request = vi.fn<typeof requestEnrich>(async (payload) => makeEnrichOutput({ lemma: payload.input }))

    const run = await processPendingEntries({ secret: 'my-secret', request })

    expect(run).toEqual({ completed: 2, merged: 0 })
    expect(request.mock.calls.map(([payload]) => payload.input)).toEqual(['knackered', 'lorry'])
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      context: "I'm knackered.",
      sourceTitle: 'Show',
      existingTopics: [{ id: expect.any(String), nameEs: 'Bares' }],
    })
    expect(request.mock.calls[0]?.[1]).toEqual({ secret: 'my-secret' })
    expect((await db.entries.get(older.id))?.status).toBe('active')
    expect((await db.entries.get(newer.id))?.status).toBe('active')
    expect(await listPendingEntries()).toEqual([])
  })

  it('stops at the first failure and leaves the rest waiting', async () => {
    const first = await savePending('one', undefined, 1_000)
    const second = await savePending('two', undefined, 2_000)
    const request = vi.fn<typeof requestEnrich>(async () => {
      throw new AiError('rate_limited', 'Saturada')
    })

    const run = await processPendingEntries({ secret: 's', request })

    expect(run.failure).toMatchObject({ code: 'rate_limited', retryable: true })
    expect(run.completed).toBe(0)
    expect(request).toHaveBeenCalledTimes(1)
    expect((await listPendingEntries()).map((entry) => entry.id)).toEqual([first.id, second.id])
  })

  it('counts the completions made before a failure', async () => {
    await savePending('one', undefined, 1_000)
    await savePending('two', undefined, 2_000)
    const request = vi
      .fn<typeof requestEnrich>()
      .mockResolvedValueOnce(makeEnrichOutput({ lemma: 'one' }))
      .mockRejectedValueOnce(new AiError('network', 'Sin conexión.'))

    const run = await processPendingEntries({ secret: 's', request })

    expect(run).toMatchObject({ completed: 1, failure: { code: 'network' } })
    expect(await listPendingEntries()).toHaveLength(1)
  })

  it('ignores entries that were deleted while waiting', async () => {
    const pending = await savePending('gone')
    await db.entries.put({ ...pending, deletedAt: 5 })
    const request = answering()

    expect(await processPendingEntries({ secret: 's', request })).toEqual({ completed: 0, merged: 0 })
    expect(request).not.toHaveBeenCalled()
  })

  it('reports merges separately', async () => {
    await saveActive('go')
    await savePending('went', 'We went.')

    expect(await processPendingEntries({ secret: 's', request: answering() })).toEqual({ completed: 0, merged: 1 })
  })
})
