import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiError, type requestEnrich } from '../../../src/ai/client.ts'
import { db } from '../../../src/db/db.ts'
import { listActive } from '../../../src/db/repo.ts'
import { buildDraftFromAi } from '../../../src/features/add/draft.ts'
import { parseBatchList, processBatchItem, runQueue } from '../../../src/features/add/batch.ts'
import { saveNewEntry } from '../../../src/features/add/save.ts'
import { makeEnrichOutput } from '../../factories.ts'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('parseBatchList', () => {
  it('reads one word per line', () => {
    expect(parseBatchList('went\nknackered\n  cheers  ')).toEqual([{ word: 'went' }, { word: 'knackered' }, { word: 'cheers' }])
  })

  it.each([
    ['went — We went home.', { word: 'went', sentence: 'We went home.' }],
    ['went—We went home.', { word: 'went', sentence: 'We went home.' }],
    ['went – We went home.', { word: 'went', sentence: 'We went home.' }],
    ['went - We went home.', { word: 'went', sentence: 'We went home.' }],
    ['go off on one — She went off on one.', { word: 'go off on one', sentence: 'She went off on one.' }],
  ])('splits "%s" into word and sentence', (line, expected) => {
    expect(parseBatchList(line)).toEqual([expected])
  })

  it('keeps hyphenated words whole', () => {
    expect(parseBatchList('well-known\nup-to-date')).toEqual([{ word: 'well-known' }, { word: 'up-to-date' }])
  })

  it('skips blank lines and repeated entries, and copes with Windows line endings', () => {
    expect(parseBatchList('went\r\n\r\nWent \nwent — We went.\r\ncheers')).toEqual([
      { word: 'went' },
      { word: 'went', sentence: 'We went.' },
      { word: 'cheers' },
    ])
  })

  it('trims words and sentences to the limits the endpoint accepts', () => {
    const [item] = parseBatchList(`${'x'.repeat(100)} — ${'y'.repeat(500)}`)
    expect(item?.word).toHaveLength(80)
    expect(item?.sentence).toHaveLength(400)
  })

  it('is empty for blank text', () => {
    expect(parseBatchList(' \n \n')).toEqual([])
  })
})

describe('runQueue', () => {
  it('processes everything with at most two items in flight', async () => {
    let inFlight = 0
    let peak = 0
    const done: number[] = []
    await runQueue(
      Array.from({ length: 7 }, (_, i) => i),
      async (item) => {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 5))
        inFlight -= 1
        done.push(item)
      },
      2,
    )

    expect(peak).toBe(2)
    expect(done.sort()).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('handles an empty list', async () => {
    await expect(runQueue([], async () => undefined)).resolves.toBeUndefined()
  })
})

describe('processBatchItem', () => {
  const answering = (output = makeEnrichOutput()) => vi.fn<typeof requestEnrich>(async () => output)
  const failing = (error: AiError) =>
    vi.fn<typeof requestEnrich>(async () => {
      throw error
    })
  const context = (request: typeof requestEnrich) => ({ secret: 's', request })

  it('saves a new word without any preview', async () => {
    const request = answering()
    const outcome = await processBatchItem({ word: 'went', sentence: 'We went home.' }, { ...context(request), sourceTitle: 'Dark', detail: 'T1' })

    expect(outcome).toEqual({ status: 'saved', lemma: 'go' })
    const [entry] = await listActive('entries')
    expect(entry).toMatchObject({ lemma: 'go', seenForm: 'went', status: 'active' })
    expect(entry?.contexts[0]).toMatchObject({ sentence: 'We went home.', detail: 'T1' })
    expect(request.mock.calls[0]?.[0]).toMatchObject({ input: 'went', context: 'We went home.', sourceTitle: 'Dark' })
    expect(await db.cards.count()).toBe(2)
  })

  it('adds the sentence to an entry the user typed exactly, without calling the AI', async () => {
    await saveNewEntry({ draft: buildDraftFromAi(makeEnrichOutput(), 'go'), status: 'active' })
    const request = answering()
    const outcome = await processBatchItem({ word: 'Go', sentence: 'Let us go.' }, context(request))

    expect(outcome).toMatchObject({ status: 'duplicate', message: 'Ya la tenías: frase añadida' })
    expect(request).not.toHaveBeenCalled()
    expect(await db.entries.count()).toBe(1)
    expect((await listActive('entries'))[0]?.contexts.map((c) => c.sentence)).toEqual(['Let us go.'])
  })

  it('detects that an inflected form belongs to an entry the user already has', async () => {
    await saveNewEntry({ draft: buildDraftFromAi(makeEnrichOutput(), 'go'), status: 'active' })
    const outcome = await processBatchItem({ word: 'went', sentence: 'We went home.' }, context(answering()))

    expect(outcome).toMatchObject({ status: 'duplicate', lemma: 'go' })
    expect(await db.entries.count()).toBe(1)
    expect(await db.cards.count()).toBe(2)
  })

  it('leaves a retryable failure as a pending entry so the AI completes it later', async () => {
    const outcome = await processBatchItem(
      { word: 'knackered', sentence: "I'm knackered." },
      context(failing(new AiError('network', 'Sin conexión.'))),
    )

    expect(outcome).toMatchObject({ status: 'pending', lemma: 'knackered' })
    const [entry] = await listActive('entries')
    expect(entry).toMatchObject({ lemma: 'knackered', status: 'pending_ai', senses: [] })
    expect(entry?.contexts[0]?.sentence).toBe("I'm knackered.")
    expect(await db.cards.count()).toBe(2)
  })

  it('reports a failure that retrying will not fix, and saves nothing', async () => {
    const outcome = await processBatchItem({ word: 'x' }, context(failing(new AiError('unauthorized', 'Secreto incorrecto.'))))

    expect(outcome).toEqual({ status: 'failed', message: 'Secreto incorrecto.' })
    expect(await db.entries.count()).toBe(0)
  })
})
