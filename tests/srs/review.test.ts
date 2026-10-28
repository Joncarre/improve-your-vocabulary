import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/db.ts'
import { saveSharedSettings } from '../../src/db/settings.ts'
import { writeRecord } from '../../src/db/repo.ts'
import { newFsrsCard } from '../../src/srs/newCard.ts'
import { recordExtraReview, reviewCard, undoReview, LEECH_LAPSES } from '../../src/srs/review.ts'
import { loadStudySnapshot, queueFromSnapshot } from '../../src/srs/studyData.ts'
import { studyDayEnd } from '../../src/srs/studyDay.ts'
import type { Card } from '../../src/shared/index.ts'
import { makeCard, makeEntry } from '../factories.ts'

const NOW = new Date(2026, 5, 10, 12, 0).getTime()
const MINUTE = 60_000
const DAY = 86_400_000

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const base = { ms: 4200, desiredRetention: 0.9, dayStartHour: 4 }

async function setup(entryOverrides = {}, recognition: Partial<Card> = {}, production: Partial<Card> = {}) {
  const entry = await writeRecord('entries', makeEntry({ id: 'e1', lemma: 'go', lemmaKey: 'go', ...entryOverrides }), { enqueue: false })
  const rec = await writeRecord('cards', makeCard({ id: 'rec', entryId: 'e1', type: 'recognition', fsrs: newFsrsCard(NOW), due: NOW, ...recognition }), { enqueue: false })
  const prod = await writeRecord(
    'cards',
    makeCard({ id: 'prod', entryId: 'e1', type: 'production', unlocked: false, fsrs: newFsrsCard(NOW), due: NOW, ...production }),
    { enqueue: false },
  )
  return { entry, rec, prod }
}

describe('reviewCard', () => {
  it('saves the answer in one go: card, statistics, log and the queue for sync', async () => {
    await setup()
    const snapshot = await reviewCard({ ...base, cardId: 'rec', grade: 3, scheduleAt: NOW, now: NOW + 1000 })

    const card = await db.cards.get('rec')
    expect(card).toMatchObject({ due: NOW + 10 * MINUTE, fsrs: { state: 1, due: NOW + 10 * MINUTE }, stats: { seen: 1, correct: 1, wrong: 0, streak: 1, lastSeenAt: NOW + 1000 } })
    const log = await db.logs.get(snapshot.logId)
    expect(log).toMatchObject({ cardId: 'rec', entryId: 'e1', at: NOW + 1000, origin: 'review', rating: 3, correct: true, ms: 4200 })
    expect((log?.fsrsLog as { state?: number } | undefined)?.state).toBe(0) // the card was new when it was answered
    expect(await db.outbox.get(['cards', 'rec'])).toBeDefined()
    expect(await db.outbox.get(['logs', snapshot.logId])).toBeDefined()
  })

  it('counts Again as a wrong answer and resets the streak; Hard counts as right', async () => {
    await setup({}, { stats: { seen: 5, correct: 5, wrong: 0, streak: 5 } })
    await reviewCard({ ...base, cardId: 'rec', grade: 2, scheduleAt: NOW })
    expect((await db.cards.get('rec'))?.stats).toMatchObject({ seen: 6, correct: 6, wrong: 0, streak: 6 })
    const again = await reviewCard({ ...base, cardId: 'rec', grade: 1, scheduleAt: NOW + MINUTE })
    expect((await db.cards.get('rec'))?.stats).toMatchObject({ seen: 7, correct: 6, wrong: 1, streak: 0 })
    expect((await db.logs.get(again.logId))?.correct).toBe(false)
  })

  it('unlocks the written card for the start of the next study day when the recognition card leaves learning', async () => {
    await setup()
    const snapshot = await reviewCard({ ...base, cardId: 'rec', grade: 4, scheduleAt: NOW, now: NOW }) // Easy: straight to review
    const end = studyDayEnd(NOW, 4)
    expect(await db.cards.get('prod')).toMatchObject({ unlocked: true, due: end, fsrs: { due: end, state: 0 } })
    expect(snapshot.siblingBefore).toMatchObject({ id: 'prod', unlocked: false })
  })

  it('does not unlock it while the recognition card is still learning', async () => {
    await setup()
    await reviewCard({ ...base, cardId: 'rec', grade: 3, scheduleAt: NOW }) // first step
    expect((await db.cards.get('prod'))?.unlocked).toBe(false)
  })

  it('unlocks it when the last learning step is passed', async () => {
    await setup()
    await reviewCard({ ...base, cardId: 'rec', grade: 3, scheduleAt: NOW })
    await reviewCard({ ...base, cardId: 'rec', grade: 3, scheduleAt: NOW + 10 * MINUTE })
    expect((await db.cards.get('rec'))?.fsrs.state).toBe(2)
    expect((await db.cards.get('prod'))?.unlocked).toBe(true)
  })

  it('does not unlock anything from an answer to the written card, and leaves an unlocked sibling alone', async () => {
    await setup({}, {}, { unlocked: true })
    const snapshot = await reviewCard({ ...base, cardId: 'prod', grade: 4, scheduleAt: NOW })
    expect(snapshot.siblingBefore).toBeUndefined()
    const rec = await reviewCard({ ...base, cardId: 'rec', grade: 4, scheduleAt: NOW })
    expect(rec.siblingBefore).toBeUndefined()
  })

  it('marks the word as "rebelde" at the sixth lapse and not before', async () => {
    const inReview = (lapses: number) => ({ fsrs: { ...newFsrsCard(NOW), state: 2, stability: 20, difficulty: 6, reps: 12, lapses, last_review: NOW - 20 * DAY, due: NOW }, due: NOW })
    await setup({}, inReview(LEECH_LAPSES - 2))
    const fifth = await reviewCard({ ...base, cardId: 'rec', grade: 1, scheduleAt: NOW })
    expect((await db.cards.get('rec'))?.fsrs.lapses).toBe(LEECH_LAPSES - 1)
    expect((await db.entries.get('e1'))?.isLeech).toBe(false)
    expect(fifth.entryBefore).toBeUndefined()

    // back in review, a sixth lapse
    await db.cards.put({ ...(await db.cards.get('rec'))!, ...inReview(LEECH_LAPSES - 1) })
    const sixth = await reviewCard({ ...base, cardId: 'rec', grade: 1, scheduleAt: NOW })
    expect((await db.entries.get('e1'))?.isLeech).toBe(true)
    expect(sixth.entryBefore).toMatchObject({ isLeech: false })
  })

  it('does not count a game failure or a learning-step failure as a lapse', async () => {
    await setup()
    await reviewCard({ ...base, cardId: 'rec', grade: 1, scheduleAt: NOW }) // Again on a new card
    expect((await db.cards.get('rec'))?.fsrs.lapses).toBe(0)
  })

  it('refuses a card that no longer exists', async () => {
    await expect(reviewCard({ ...base, cardId: 'nope', grade: 3, scheduleAt: NOW })).rejects.toThrow()
  })
})

describe('undoReview', () => {
  it('puts back the card, its statistics, the sibling and the rebelde mark, and deletes the log', async () => {
    const { rec } = await setup()
    const snapshot = await reviewCard({ ...base, cardId: 'rec', grade: 4, scheduleAt: NOW })
    expect((await db.cards.get('prod'))?.unlocked).toBe(true)

    await undoReview(snapshot, NOW + 5000)

    expect(await db.cards.get('rec')).toMatchObject({ fsrs: rec.fsrs, due: rec.due, stats: rec.stats })
    expect(await db.cards.get('prod')).toMatchObject({ unlocked: false, due: NOW })
    expect(await db.logs.get(snapshot.logId)).toMatchObject({ deletedAt: NOW + 5000 })
    // what was restored travels to the other device too
    expect(await db.outbox.get(['cards', 'rec'])).toBeDefined()
    expect(await db.outbox.get(['logs', snapshot.logId])).toBeDefined()
  })

  it('takes the rebelde mark away again', async () => {
    const lapsing = { fsrs: { ...newFsrsCard(NOW), state: 2, stability: 20, difficulty: 6, reps: 12, lapses: LEECH_LAPSES - 1, last_review: NOW - 20 * DAY, due: NOW }, due: NOW }
    await setup({}, lapsing)
    const snapshot = await reviewCard({ ...base, cardId: 'rec', grade: 1, scheduleAt: NOW })
    expect((await db.entries.get('e1'))?.isLeech).toBe(true)
    await undoReview(snapshot)
    expect((await db.entries.get('e1'))?.isLeech).toBe(false)
    expect((await db.cards.get('rec'))?.fsrs.lapses).toBe(LEECH_LAPSES - 1)
  })

  it('can undo several answers in reverse order', async () => {
    await setup()
    const first = await reviewCard({ ...base, cardId: 'rec', grade: 3, scheduleAt: NOW })
    const second = await reviewCard({ ...base, cardId: 'rec', grade: 3, scheduleAt: NOW + 10 * MINUTE })
    await undoReview(second)
    expect((await db.cards.get('rec'))?.stats.seen).toBe(1)
    await undoReview(first)
    expect((await db.cards.get('rec'))?.stats.seen).toBe(0)
    expect((await db.cards.get('rec'))?.fsrs.state).toBe(0)
  })
})

describe('recordExtraReview', () => {
  it('updates the statistics and leaves an "extra" log, but never the calendar', async () => {
    const future = { fsrs: { ...newFsrsCard(NOW), state: 2, stability: 30, last_review: NOW - DAY, due: NOW + 30 * DAY }, due: NOW + 30 * DAY }
    const { rec } = await setup({}, future)
    const snapshot = await recordExtraReview({ cardId: 'rec', correct: false, ms: 3000, now: NOW })

    const card = await db.cards.get('rec')
    expect(card?.fsrs).toEqual(rec.fsrs)
    expect(card?.due).toBe(rec.due)
    expect(card?.stats).toMatchObject({ seen: 1, wrong: 1, streak: 0 })
    expect(await db.logs.get(snapshot.logId)).toMatchObject({ origin: 'extra', correct: false })
    expect((await db.logs.get(snapshot.logId))?.rating).toBeUndefined()

    await undoReview(snapshot)
    expect((await db.cards.get('rec'))?.stats.seen).toBe(0)
  })
})

describe('the study snapshot and the queue after answers', () => {
  it('counts the new cards started today and keeps the sibling out of today', async () => {
    await setup({ createdAt: 1 }, {}, { unlocked: true })
    await saveSharedSettings({ newPerDay: 5 })
    let queue = queueFromSnapshot(await loadStudySnapshot(NOW), NOW)
    expect(queue.items.map((item) => item.card.id)).toEqual(['rec']) // one card per word, even with both new and due
    expect(queue.counts.new).toBe(1)

    await reviewCard({ ...base, cardId: 'rec', grade: 1, scheduleAt: NOW, now: NOW })
    const snapshot = await loadStudySnapshot(NOW + 30_000)
    expect(snapshot.logsToday).toHaveLength(1)
    queue = queueFromSnapshot(snapshot, NOW + 70 * 1000)
    // the answered card comes back for its learning step; the written one waits for tomorrow
    expect(queue.items.map((item) => [item.card.id, item.kind])).toEqual([['rec', 'learning']])
  })

  it('applies the daily limit across the answers given today', async () => {
    for (const lemma of ['a', 'b', 'c']) {
      // each word has its own meaning: identical ones would count as near-synonyms and be kept apart
      const senses = [{ ...makeEntry().senses[0]!, id: `s-${lemma}`, meaningEs: `significado ${lemma}` }]
      await writeRecord('entries', makeEntry({ id: lemma, lemma, lemmaKey: lemma, createdAt: lemma.charCodeAt(0), senses }), { enqueue: false })
      await writeRecord('cards', makeCard({ id: `card-${lemma}`, entryId: lemma, fsrs: newFsrsCard(NOW), due: NOW }), { enqueue: false })
    }
    await saveSharedSettings({ newPerDay: 2 })
    await reviewCard({ ...base, cardId: 'card-a', grade: 3, scheduleAt: NOW, now: NOW })
    const queue = queueFromSnapshot(await loadStudySnapshot(NOW + MINUTE), NOW + MINUTE)
    // a has been started (1 of 2); b may still come, c may not
    expect(queue.items.filter((item) => item.kind === 'new').map((item) => item.entry.id)).toEqual(['b'])
  })

  it('ignores undone answers and answers from other days', async () => {
    await setup()
    const snapshot = await reviewCard({ ...base, cardId: 'rec', grade: 3, scheduleAt: NOW, now: NOW })
    await undoReview(snapshot, NOW + 1000)
    expect((await loadStudySnapshot(NOW + 2000)).logsToday).toHaveLength(0)
    await reviewCard({ ...base, cardId: 'rec', grade: 3, scheduleAt: NOW, now: NOW - 2 * DAY })
    expect((await loadStudySnapshot(NOW)).logsToday).toHaveLength(0)
  })
})
