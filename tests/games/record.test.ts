import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/db.ts'
import { writeRecord } from '../../src/db/repo.ts'
import { broughtToToday, isBetterResult, loadBestResult, loadGameTurns, recordGameAnswer, saveGameResult } from '../../src/games/record.ts'
import { studyDayEnd } from '../../src/srs/studyDay.ts'
import type { Card } from '../../src/shared/index.ts'
import { makeCard, makeEntry, makeLog } from '../factories.ts'
import { DAY, NOW } from './helpers.ts'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const reviewCard = (overrides: Partial<Card> = {}): Card => {
  const due = overrides.due ?? NOW + 10 * DAY
  return makeCard({
    id: 'rec',
    entryId: 'e1',
    due,
    fsrs: { due, stability: 12, difficulty: 5, elapsed_days: 0, scheduled_days: 10, learning_steps: 0, reps: 6, lapses: 0, state: 2, last_review: NOW - DAY },
    stats: { seen: 5, correct: 5, wrong: 0, streak: 5 },
    ...overrides,
  })
}

const options = { prefer: 'recognition' as const, dayStartHour: 4, now: NOW }

async function setup(recognition: Partial<Card> = {}, production?: Partial<Card>) {
  await writeRecord('entries', makeEntry({ id: 'e1' }), { enqueue: false })
  await writeRecord('cards', reviewCard(recognition), { enqueue: false })
  if (production) await writeRecord('cards', reviewCard({ id: 'prod', type: 'production', ...production }), { enqueue: false })
}

describe('broughtToToday', () => {
  it('moves a review card that was due after the study day to now, and nothing else', () => {
    const later = reviewCard({ due: NOW + 10 * DAY })
    expect(broughtToToday(later, NOW, 4)).toMatchObject({ due: NOW, fsrs: { due: NOW } })
    const today = reviewCard({ due: studyDayEnd(NOW, 4) - 1000 })
    expect(broughtToToday(today, NOW, 4)).toBe(today)
    const learning = reviewCard({ due: NOW + 10 * DAY, fsrs: { ...reviewCard().fsrs, state: 1 } })
    expect(broughtToToday(learning, NOW, 4)).toBe(learning)
    const fresh = reviewCard({ due: NOW + 10 * DAY, fsrs: { ...reviewCard().fsrs, state: 0 } })
    expect(broughtToToday(fresh, NOW, 4)).toBe(fresh)
  })
})

describe('recordGameAnswer', () => {
  it('saves a right answer: statistics and a log from the game, and the calendar stays as it was', async () => {
    await setup()
    expect(await recordGameAnswer('cloze', { entryId: 'e1', correct: true, ms: 3200 }, options)).toBe(true)

    const card = await db.cards.get('rec')
    expect(card).toMatchObject({ due: NOW + 10 * DAY, stats: { seen: 6, correct: 6, wrong: 0, streak: 6, lastSeenAt: NOW } })
    expect(card?.fsrs.due).toBe(NOW + 10 * DAY)
    const logs = await db.logs.toArray()
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ cardId: 'rec', entryId: 'e1', origin: 'game:cloze', correct: true, ms: 3200, at: NOW })
    expect(logs[0]?.rating).toBeUndefined()
    expect(await db.outbox.get(['cards', 'rec'])).toBeDefined()
    expect(await db.outbox.get(['logs', logs[0]?.id ?? ''])).toBeDefined()
  })

  it('a mistake counts against the word and brings a card due later back to today', async () => {
    await setup()
    await recordGameAnswer('match', { entryId: 'e1', correct: false, ms: 900 }, options)
    expect(await db.cards.get('rec')).toMatchObject({ due: NOW, fsrs: { due: NOW, state: 2 }, stats: { seen: 6, correct: 5, wrong: 1, streak: 0 } })
    expect((await db.logs.toArray())[0]).toMatchObject({ origin: 'game:match', correct: false })
  })

  it('a mistake does not touch a card that is already due today or still learning', async () => {
    const dueToday = studyDayEnd(NOW, 4) - 60_000
    await setup({ due: dueToday })
    await recordGameAnswer('family', { entryId: 'e1', correct: false, ms: 1 }, options)
    expect((await db.cards.get('rec'))?.due).toBe(dueToday)

    await db.cards.clear()
    await writeRecord('cards', reviewCard({ due: NOW + 10 * DAY, fsrs: { ...reviewCard().fsrs, state: 3 } }), { enqueue: false })
    await recordGameAnswer('family', { entryId: 'e1', correct: false, ms: 1 }, options)
    expect((await db.cards.get('rec'))?.due).toBe(NOW + 10 * DAY)
  })

  it('counts for the written card when the game asks for English and that card is unlocked, otherwise for the recognition one', async () => {
    await setup({}, { unlocked: false })
    await recordGameAnswer('cloze', { entryId: 'e1', correct: true, ms: 1 }, { ...options, prefer: 'production' })
    expect((await db.cards.get('rec'))?.stats.seen).toBe(6)
    expect((await db.cards.get('prod'))?.stats.seen).toBe(5)

    await db.cards.update('prod', { unlocked: true })
    await recordGameAnswer('cloze', { entryId: 'e1', correct: true, ms: 1 }, { ...options, prefer: 'production' })
    expect((await db.cards.get('prod'))?.stats.seen).toBe(6)
    expect((await db.cards.get('rec'))?.stats.seen).toBe(6)
  })

  it('does nothing when the word has no card in play (archived or suspended while the game was open)', async () => {
    await setup({ suspended: true })
    expect(await recordGameAnswer('cloze', { entryId: 'e1', correct: false, ms: 1 }, options)).toBe(false)
    expect(await db.logs.count()).toBe(0)
    expect((await db.cards.get('rec'))?.due).toBe(NOW + 10 * DAY)
    expect(await recordGameAnswer('cloze', { entryId: 'nobody', correct: true, ms: 1 }, options)).toBe(false)
  })

  it('does not count in the streak of days or in the reviews of the day', async () => {
    await setup()
    await recordGameAnswer('cloze', { entryId: 'e1', correct: true, ms: 1 }, options)
    expect((await db.logs.toArray()).some((log) => log.origin === 'review' || log.origin === 'extra')).toBe(false)
  })
})

describe('results and records', () => {
  it('saves a result with its variant and queues it for sync', async () => {
    const result = await saveGameResult({ game: 'match', score: 5, total: 6, durationMs: 41_234.4, variant: 'ipa', now: NOW })
    expect(await db.games.get(result.id)).toMatchObject({ game: 'match', score: 5, total: 6, durationMs: 41_234, variant: 'ipa', at: NOW })
    expect(await db.outbox.get(['games', result.id])).toBeDefined()
    expect((await saveGameResult({ game: 'cloze', score: 1, total: 2, durationMs: 5, now: NOW })).variant).toBeUndefined()
  })

  it('compares Parejas by time and the rest by the share of right answers, then time', () => {
    expect(isBetterResult('match', { score: 3, total: 6, durationMs: 30_000 }, { score: 6, total: 6, durationMs: 40_000 })).toBe(true)
    expect(isBetterResult('match', { score: 6, total: 6, durationMs: 50_000 }, { score: 6, total: 6, durationMs: 40_000 })).toBe(false)
    expect(isBetterResult('cloze', { score: 9, total: 10, durationMs: 90_000 }, { score: 8, total: 10, durationMs: 30_000 })).toBe(true)
    expect(isBetterResult('cloze', { score: 4, total: 5, durationMs: 90_000 }, { score: 8, total: 10, durationMs: 120_000 })).toBe(true) // same share, faster
    expect(isBetterResult('cloze', { score: 4, total: 5, durationMs: 130_000 }, { score: 8, total: 10, durationMs: 120_000 })).toBe(false)
    expect(isBetterResult('cloze', { score: 0, total: 0, durationMs: 1 }, { score: 1, total: 10, durationMs: 1 })).toBe(false)
  })

  it('finds the record of a game and variant, ignoring other games, other variants and deleted results', async () => {
    await saveGameResult({ game: 'match', score: 6, total: 6, durationMs: 60_000, variant: 'es', now: 1 })
    await saveGameResult({ game: 'match', score: 6, total: 6, durationMs: 45_000, variant: 'es', now: 2 })
    await saveGameResult({ game: 'match', score: 6, total: 6, durationMs: 20_000, variant: 'ipa', now: 3 })
    await saveGameResult({ game: 'cloze', score: 10, total: 10, durationMs: 10_000, variant: 'choose', now: 4 })
    const deleted = await saveGameResult({ game: 'match', score: 6, total: 6, durationMs: 5_000, variant: 'es', now: 5 })
    await db.games.update(deleted.id, { deletedAt: 6 })

    expect((await loadBestResult('match', 'es'))?.durationMs).toBe(45_000)
    expect((await loadBestResult('match', 'ipa'))?.durationMs).toBe(20_000)
    expect((await loadBestResult('match', 'definition'))).toBeUndefined()
    expect((await loadBestResult('verb_forms', 'choose'))).toBeUndefined()
  })

  it('counts how many times each word was played in a game, without the deleted logs', async () => {
    await db.logs.bulkPut([
      makeLog({ entryId: 'a', origin: 'game:cloze' }),
      makeLog({ entryId: 'a', origin: 'game:cloze' }),
      makeLog({ entryId: 'b', origin: 'game:cloze' }),
      makeLog({ entryId: 'a', origin: 'game:cloze', deletedAt: 5 }),
      makeLog({ entryId: 'a', origin: 'game:match' }),
      makeLog({ entryId: 'a', origin: 'review' }),
    ])
    expect(await loadGameTurns('cloze')).toEqual(new Map([['a', 2], ['b', 1]]))
    expect((await loadGameTurns('family')).size).toBe(0)
  })
})
