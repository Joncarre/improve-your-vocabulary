import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../src/db/db.ts'
import { writeRecord } from '../../../src/db/repo.ts'
import { loadProgress } from '../../../src/features/progress/data.ts'
import { makeCard, makeEntry, makeLog } from '../../factories.ts'

beforeAll(() => {
  process.env.TZ = 'Europe/Madrid'
})

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const at = (year: number, month: number, day: number, hour = 12) => new Date(year, month - 1, day, hour).getTime()
const NOW = at(2026, 10, 28)
const DAY = 86_400_000
const reviewFsrs = (due: number) => ({ due, stability: 30, difficulty: 5, elapsed_days: 0, scheduled_days: 30, learning_steps: 0, reps: 6, lapses: 0, state: 2 })
const save = { enqueue: false }

describe('loadProgress', () => {
  it('has nothing to show on an empty database', async () => {
    const data = await loadProgress(NOW)
    expect(data).toMatchObject({ words: 0, added: 0, failed: [], streak: { days: 0, doneToday: false }, accuracy: { total: 0, rate: null } })
    expect(data.days).toHaveLength(30)
    expect(data.forecast).toHaveLength(7)
    expect(data.weeks).toHaveLength(8)
  })

  it('puts the collection, the reviews and the schedule together', async () => {
    await writeRecord('entries', makeEntry({ id: 'a', lemma: 'steep', createdAt: at(2026, 10, 27) }), save)
    await writeRecord('entries', makeEntry({ id: 'b', lemma: 'slope', createdAt: at(2026, 9, 10) }), save)
    await writeRecord('entries', makeEntry({ id: 'old', lemma: 'den', status: 'archived', createdAt: at(2026, 10, 1) }), save)
    await writeRecord('cards', makeCard({ id: 'ca', entryId: 'a', due: NOW + 2 * DAY, fsrs: reviewFsrs(NOW + 2 * DAY) }), save)
    await writeRecord('cards', makeCard({ id: 'cb', entryId: 'b', due: NOW - DAY, fsrs: reviewFsrs(NOW - DAY) }), save)
    await writeRecord('cards', makeCard({ id: 'cold', entryId: 'old', due: NOW, fsrs: reviewFsrs(NOW) }), save)
    for (const log of [
      makeLog({ entryId: 'a', cardId: 'ca', at: NOW - 1000, correct: true }),
      makeLog({ entryId: 'a', cardId: 'ca', at: at(2026, 10, 27), correct: false }),
      makeLog({ entryId: 'b', cardId: 'cb', at: at(2026, 10, 26), correct: false }),
      makeLog({ entryId: 'b', cardId: 'cb', at: at(2026, 10, 20), correct: false, origin: 'game:match' }),
      makeLog({ entryId: 'b', cardId: 'cb', at: at(2026, 10, 25), correct: false, deletedAt: 5 }),
    ]) {
      await writeRecord('logs', log, save)
    }

    const data = await loadProgress(NOW)

    expect(data.words).toBe(2) // "den" is archived
    expect(data.added).toBe(3) // but it was added
    expect(data.states.consolidated).toBe(2)
    expect(data.streak).toEqual({ days: 3, doneToday: true })
    expect(data.accuracy).toEqual({ correct: 1, total: 3, rate: 1 / 3 })
    expect(data.days[29]).toMatchObject({ total: 1, correct: 1 })
    expect(data.forecast.map((day) => day.count)).toEqual([1, 0, 1, 0, 0, 0, 0]) // the overdue card of "slope" is today's
    // Weeks of Monday 7 Sep to Monday 26 Oct: "slope" (10 Sep), "den" (1 Oct, archived but added) and "steep" (27 Oct).
    expect(data.weeks.map((week) => week.count)).toEqual([1, 0, 0, 1, 0, 0, 0, 1])
    expect(data.failed.map((item) => [item.entry.lemma, item.fails])).toEqual([['steep', 1], ['slope', 1]])
  })

  it('finds a failure from before the 400 days of the streak, because the most failed is all time', async () => {
    await writeRecord('entries', makeEntry({ id: 'x', lemma: 'ancient' }), save)
    await writeRecord('logs', makeLog({ entryId: 'x', at: NOW - 800 * DAY, correct: false }), save)
    expect((await loadProgress(NOW)).failed.map((item) => item.entry.lemma)).toEqual(['ancient'])
  })
})
