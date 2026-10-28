import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiError, type callAi } from '../../../src/ai/client.ts'
import { db } from '../../../src/db/db.ts'
import { getActive, writeRecord } from '../../../src/db/repo.ts'
import {
  applyRegeneratedExamples,
  deleteEntry,
  regenerateExamples,
  resetProgress,
  saveEntryEdits,
  setArchived,
} from '../../../src/features/entry/actions.ts'
import { saveNewEntry } from '../../../src/features/add/save.ts'
import { buildDraftFromAi } from '../../../src/features/add/draft.ts'
import type { ReviewLog } from '../../../src/shared/index.ts'
import { makeEnrichOutput, makeEntry } from '../../factories.ts'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const saveGo = () => saveNewEntry({ draft: buildDraftFromAi(makeEnrichOutput(), 'went'), status: 'active', sentence: 'We went home.', now: 1_000 })

const log = (entryId: string, cardId: string, at: number): ReviewLog => ({
  id: `log-${at}`,
  cardId,
  entryId,
  at,
  origin: 'review',
  correct: true,
  ms: 900,
  updatedAt: at,
})

describe('setArchived', () => {
  it('archives and restores, queueing the change for sync', async () => {
    const entry = await saveGo()
    await db.outbox.clear()

    expect((await setArchived(entry.id, true, 5_000))?.status).toBe('archived')
    expect((await getActive('entries', entry.id))?.status).toBe('archived')
    expect(await db.outbox.get(['entries', entry.id])).toBeDefined()

    expect((await setArchived(entry.id, false, 6_000))?.status).toBe('active')
  })

  it('does nothing for an entry that no longer exists', async () => {
    expect(await setArchived('missing', true)).toBeUndefined()
  })
})

describe('resetProgress', () => {
  it('sends both cards back to new, locks production again and clears the counters', async () => {
    const entry = await saveGo()
    const cards = await db.cards.where('entryId').equals(entry.id).toArray()
    for (const card of cards) {
      await db.cards.put({
        ...card,
        unlocked: true,
        suspended: true,
        due: 99_000,
        fsrs: { ...card.fsrs, state: 2, stability: 40, reps: 9, lapses: 2 },
        stats: { seen: 12, correct: 9, wrong: 3, streak: 4, lastSeenAt: 90_000 },
      })
    }

    await resetProgress(entry.id, 50_000)

    for (const card of await db.cards.where('entryId').equals(entry.id).toArray()) {
      expect(card).toMatchObject({
        due: 50_000,
        suspended: false,
        fsrs: { state: 0, reps: 0, lapses: 0, stability: 0 },
        stats: { seen: 0, correct: 0, wrong: 0, streak: 0 },
        unlocked: card.type === 'recognition',
      })
      expect(card.stats.lastSeenAt).toBeUndefined()
    }
  })

  it('clears the "rebelde" mark and deletes the history of answers, leaving other words alone', async () => {
    const entry = await saveGo()
    await db.entries.put({ ...entry, isLeech: true })
    const [card] = await db.cards.where('entryId').equals(entry.id).toArray()
    const other = await saveNewEntry({ draft: buildDraftFromAi(makeEnrichOutput({ lemma: 'stop' }), 'stop'), status: 'active' })
    await db.logs.bulkPut([log(entry.id, card?.id ?? '', 1), log(entry.id, card?.id ?? '', 2), log(other.id, 'x', 3)])

    await resetProgress(entry.id, 70_000)

    expect((await db.entries.get(entry.id))?.isLeech).toBe(false)
    const logs = await db.logs.toArray()
    expect(logs.filter((l) => l.entryId === entry.id).every((l) => l.deletedAt === 70_000)).toBe(true)
    expect(logs.find((l) => l.entryId === other.id)?.deletedAt).toBeUndefined()
    expect(await db.outbox.get(['logs', 'log-1'])).toBeDefined()
  })
})

describe('deleteEntry', () => {
  it('deletes the entry and its cards logically and keeps the answers as history', async () => {
    const entry = await saveGo()
    const [card] = await db.cards.where('entryId').equals(entry.id).toArray()
    await db.logs.put(log(entry.id, card?.id ?? '', 1))

    await deleteEntry(entry.id, 80_000)

    expect(await getActive('entries', entry.id)).toBeUndefined()
    expect((await db.entries.get(entry.id))?.deletedAt).toBe(80_000)
    expect((await db.cards.where('entryId').equals(entry.id).toArray()).every((c) => c.deletedAt === 80_000)).toBe(true)
    expect((await db.logs.get('log-1'))?.deletedAt).toBeUndefined()
    expect(await db.outbox.get(['entries', entry.id])).toBeDefined()
  })
})

describe('saveEntryEdits', () => {
  it('saves valid edits and recomputes the key', async () => {
    const entry = await saveGo()
    const result = await saveEntryEdits({ ...entry, lemma: '  Travel ', ipa: '/ˈtrævl/' }, 9_000)

    expect(result.ok).toBe(true)
    expect(await db.entries.get(entry.id)).toMatchObject({ lemma: 'Travel', lemmaKey: 'travel', ipa: '/ˈtrævl/', updatedAt: 9_000 })
  })

  it('refuses a word another entry already has', async () => {
    const go = await saveGo()
    const other = await saveNewEntry({ draft: buildDraftFromAi(makeEnrichOutput({ lemma: 'stop' }), 'stop'), status: 'active' })

    const result = await saveEntryEdits({ ...other, lemma: 'GO' })

    expect(result).toMatchObject({ ok: false, reason: 'duplicate' })
    expect(await db.entries.get(other.id)).toMatchObject({ lemma: 'stop' })
    expect(go.lemma).toBe('go')
  })

  it('allows keeping the same word', async () => {
    const entry = await saveGo()
    expect((await saveEntryEdits({ ...entry, learnerNote: 'Cuidado.' })).ok).toBe(true)
  })

  it('refuses an empty word and invalid data', async () => {
    const entry = await saveGo()

    expect(await saveEntryEdits({ ...entry, lemma: '  ' })).toMatchObject({ ok: false, reason: 'invalid' })
    expect(await saveEntryEdits({ ...entry, cefr: 'Z9' as never })).toMatchObject({ ok: false, reason: 'invalid' })
  })
})

describe('applyRegeneratedExamples', () => {
  const entry = makeEntry()
  const output = {
    senses: [
      { examples: [{ en: ' I go to school. ', es: ' Voy al colegio. ', target: ' go ' }, { en: 'We go home.', es: 'Vamos a casa.', target: 'go' }, { en: 'Third.', es: 'Tercera.', target: '' }] },
    ],
  }

  it('replaces the examples of each sense with the new ones (trimmed, at most two)', () => {
    const result = applyRegeneratedExamples(entry, output)

    expect(result.senses[0]?.examples).toEqual([
      { en: 'I go to school.', es: 'Voy al colegio.', target: 'go' },
      { en: 'We go home.', es: 'Vamos a casa.', target: 'go' },
    ])
    expect(result.senses[0]?.meaningEs).toBe(entry.senses[0]?.meaningEs)
  })

  it('keeps the old examples of a sense the model gave nothing for', () => {
    const two = makeEntry({ senses: [...entry.senses, { ...entry.senses[0]!, id: 's2', meaningEs: 'otro' }] })
    const result = applyRegeneratedExamples(two, output)

    expect(result.senses[1]?.examples).toEqual(two.senses[1]?.examples)
  })
})

describe('regenerateExamples', () => {
  const answer = (): Awaited<ReturnType<typeof callAi>> => ({
    ok: true,
    mode: 'examples_only',
    data: { senses: [{ examples: [{ en: 'Brand new example.', es: 'Ejemplo nuevo.', target: 'go' }] }] },
    meta: { model: 'm', ms: 1, inputTokens: 1, outputTokens: 1 },
  })

  it('asks for the entry\'s senses and stores the new examples', async () => {
    const entry = await saveGo()
    const request = vi.fn<typeof callAi>(async () => answer())

    const updated = await regenerateExamples(entry.id, { secret: 's', request })

    expect(request.mock.calls[0]?.[0]).toMatchObject({
      input: 'go',
      mode: 'examples_only',
      senses: [
        { pos: 'verb', meaningEs: 'ir' },
        { pos: 'noun', meaningEs: 'turno' },
      ],
    })
    expect(updated.senses[0]?.examples).toEqual([{ en: 'Brand new example.', es: 'Ejemplo nuevo.', target: 'go' }])
    expect((await db.entries.get(entry.id))?.senses[0]?.examples[0]?.en).toBe('Brand new example.')
  })

  it('sends at most four senses', async () => {
    const entry = await saveGo()
    const sense = entry.senses[0]!
    await db.entries.put({ ...entry, senses: Array.from({ length: 6 }, (_, i) => ({ ...sense, id: `s${i}`, meaningEs: `m${i}` })) })
    const request = vi.fn<typeof callAi>(async () => answer())

    await regenerateExamples(entry.id, { secret: 's', request })

    expect(request.mock.calls[0]?.[0].senses).toHaveLength(4)
  })

  it('leaves the entry untouched when the AI fails', async () => {
    const entry = await saveGo()
    const request = vi.fn<typeof callAi>(async () => {
      throw new AiError('rate_limited', 'Saturada')
    })

    await expect(regenerateExamples(entry.id, { secret: 's', request })).rejects.toMatchObject({ code: 'rate_limited' })
    expect((await db.entries.get(entry.id))?.senses[0]?.examples).toEqual(entry.senses[0]?.examples)
  })

  it('needs senses to write examples for', async () => {
    const empty = await writeRecord('entries', makeEntry({ senses: [] }))

    await expect(regenerateExamples(empty.id, { secret: 's', request: vi.fn<typeof callAi>() })).rejects.toBeInstanceOf(AiError)
  })

  it('refuses an entry that no longer exists', async () => {
    await expect(regenerateExamples('missing', { secret: 's' })).rejects.toThrow()
  })
})
