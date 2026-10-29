import { beforeAll, describe, expect, it } from 'vitest'
import {
  accuracyOf,
  addedPerWeek,
  dayKeys,
  FAILED_LIMIT,
  forecast,
  mostFailed,
  reviewsPerDay,
  stateCounts,
  totalWords,
} from '../../../src/features/progress/stats.ts'
import { addDaysToKey, mondayOfKey } from '../../../src/srs/studyDay.ts'
import type { Card } from '../../../src/shared/index.ts'
import { makeCard, makeEntry, makeLog } from '../../factories.ts'

beforeAll(() => {
  // The clocks change in Madrid on 2026-03-29 and 2026-10-25 (a day of 25 hours): the windows must not lose or repeat a day.
  process.env.TZ = 'Europe/Madrid'
})

const at = (year: number, month: number, day: number, hour = 12, minute = 0) => new Date(year, month - 1, day, hour, minute).getTime()
/** Wednesday 28 October 2026, noon. */
const NOW = at(2026, 10, 28)
const H = 4

describe('dayKeys', () => {
  it('lists the days in a row, oldest first, ending today', () => {
    expect(dayKeys(NOW, H, 3)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28'])
  })

  it('starts today when it looks forward', () => {
    expect(dayKeys(NOW, H, 3, 'forward')).toEqual(['2026-10-28', '2026-10-29', '2026-10-30'])
  })

  it('counts the days after midnight but before the study day starts as the day before', () => {
    expect(dayKeys(at(2026, 10, 28, 2, 30), H, 2)).toEqual(['2026-10-26', '2026-10-27'])
  })

  it('does not lose or repeat a day over the change of clocks, nor over the new year', () => {
    const keys = dayKeys(at(2026, 10, 28), H, 30)
    expect(keys).toHaveLength(30)
    expect(new Set(keys).size).toBe(30)
    expect(keys).toContain('2026-10-25')
    expect(dayKeys(at(2027, 1, 2), H, 4)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
  })
})

describe('reviewsPerDay and accuracyOf', () => {
  const review = (when: number, correct = true, overrides = {}) => makeLog({ at: when, correct, origin: 'review', ...overrides })

  it('counts the regular reviews of each of the last 30 days, with those answered right', () => {
    const logs = [review(at(2026, 10, 28, 9)), review(at(2026, 10, 28, 10), false), review(at(2026, 10, 27, 20)), review(at(2026, 9, 29, 8))]
    const days = reviewsPerDay(logs, NOW, H)
    expect(days).toHaveLength(30)
    expect(days[0]?.key).toBe('2026-09-29')
    expect(days[29]).toEqual({ key: '2026-10-28', total: 2, correct: 1 })
    expect(days[28]).toEqual({ key: '2026-10-27', total: 1, correct: 1 })
    expect(days[0]).toEqual({ key: '2026-09-29', total: 1, correct: 1 })
  })

  it('leaves out what is not a regular review: games, extra reviews, undone ones and anything older than 30 days', () => {
    const logs = [
      review(at(2026, 10, 28, 9)),
      makeLog({ at: at(2026, 10, 28, 9), origin: 'game:cloze', correct: true }),
      makeLog({ at: at(2026, 10, 28, 9), origin: 'extra', correct: true }),
      review(at(2026, 10, 28, 9), true, { deletedAt: 5 }),
      review(at(2026, 9, 28, 9)),
      review(at(2026, 10, 29, 9)),
    ]
    const days = reviewsPerDay(logs, NOW, H)
    expect(days.reduce((sum, day) => sum + day.total, 0)).toBe(1)
  })

  it('puts a late-night review on the study day it belongs to', () => {
    const days = reviewsPerDay([review(at(2026, 10, 28, 2, 30)), review(at(2026, 10, 28, 4, 0))], NOW, H)
    expect(days[28]?.total).toBe(1) // 02:30 is still the 27th
    expect(days[29]?.total).toBe(1)
  })

  it('adds up the accuracy, and has none before the first answer', () => {
    const days = reviewsPerDay([review(NOW), review(NOW), review(NOW, false), review(at(2026, 10, 20), false)], NOW, H)
    expect(accuracyOf(days)).toEqual({ correct: 2, total: 4, rate: 0.5 })
    expect(accuracyOf(reviewsPerDay([], NOW, H))).toEqual({ correct: 0, total: 0, rate: null })
  })
})

describe('stateCounts', () => {
  const reviewCard = (entryId: string, stability: number, streak = 0, extra: Partial<Card> = {}) =>
    makeCard({
      entryId,
      fsrs: { due: NOW, stability, difficulty: 5, elapsed_days: 0, scheduled_days: 5, learning_steps: 0, reps: 5, lapses: 0, state: 2 },
      stats: { seen: 5, correct: 5, wrong: 0, streak },
      ...extra,
    })

  it('puts each word in the state of its weakest active card', () => {
    const entries = ['n', 'l', 'r', 'c', 'm'].map((id) => makeEntry({ id }))
    const cards = [
      makeCard({ entryId: 'n' }),
      makeCard({ entryId: 'l', fsrs: { ...makeCard().fsrs, state: 1 } }),
      reviewCard('r', 5),
      reviewCard('c', 30),
      reviewCard('m', 90, 6),
      // a production card that is better does not lift the word; one that is worse does
      reviewCard('c', 90, 6, { type: 'production' }),
      reviewCard('m', 5, 0, { type: 'production' }),
    ]
    expect(stateCounts(entries, cards)).toEqual({ new: 1, learning: 1, review: 2, consolidated: 1, mastered: 0 })
  })

  it('leaves out archived words, those waiting for the AI and deleted ones, and ignores locked cards', () => {
    const entries = [
      makeEntry({ id: 'ok' }),
      makeEntry({ id: 'archived', status: 'archived' }),
      makeEntry({ id: 'pending', status: 'pending_ai' }),
      makeEntry({ id: 'deleted', deletedAt: 1 }),
      makeEntry({ id: 'locked' }),
    ]
    // "locked" has a good card and a weak production card that is still locked: the locked one does not count.
    const cards = [reviewCard('ok', 30), reviewCard('archived', 30), reviewCard('locked', 30), reviewCard('locked', 5, 0, { type: 'production', unlocked: false })]
    const counts = stateCounts(entries, cards)
    expect(totalWords(counts)).toBe(2)
    expect(counts.consolidated).toBe(2)
  })
})

describe('forecast', () => {
  const due = (entryId: string, when: number, overrides: Partial<Card> = {}) =>
    makeCard({ entryId, due: when, fsrs: { due: when, stability: 5, difficulty: 5, elapsed_days: 0, scheduled_days: 5, learning_steps: 0, reps: 3, lapses: 0, state: 2 }, ...overrides })
  const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })]

  it('counts the cards of each of the next 7 days and puts what is overdue in today', () => {
    const cards = [
      due('a', at(2026, 10, 20)), // overdue
      due('a', at(2026, 10, 28, 18)),
      due('b', at(2026, 10, 29, 9)),
      due('b', at(2026, 10, 29, 22)),
      due('a', at(2026, 11, 3, 5)), // the 7th day
    ]
    const days = forecast(entries, cards, NOW, H)
    expect(days.map((day) => day.key)).toEqual(['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03'])
    expect(days.map((day) => day.count)).toEqual([2, 2, 0, 0, 0, 0, 1])
  })

  it('does not count a card due after the 7 days, nor new, suspended or locked cards', () => {
    const cards = [
      due('a', at(2026, 11, 4, 5)),
      makeCard({ entryId: 'a', due: NOW }), // new
      due('a', NOW, { suspended: true }),
      due('b', NOW, { unlocked: false }),
      due('b', NOW, { deletedAt: 3 }),
    ]
    expect(forecast(entries, cards, NOW, H).reduce((sum, day) => sum + day.count, 0)).toBe(0)
  })

  it('does not count the cards of an archived or deleted word', () => {
    const gone = [makeEntry({ id: 'x', status: 'archived' }), makeEntry({ id: 'y', deletedAt: 1 })]
    expect(forecast(gone, [due('x', NOW), due('y', NOW)], NOW, H).reduce((sum, day) => sum + day.count, 0)).toBe(0)
  })

  it('moves the days at the hour the study day starts: 03:59 is still the day before', () => {
    const cards = [due('a', at(2026, 10, 29, 3, 59)), due('a', at(2026, 10, 29, 4, 0))]
    expect(forecast(entries, cards, NOW, H).map((day) => day.count).slice(0, 3)).toEqual([1, 1, 0])
  })

  it('counts a card that is learning and due in a few minutes as today', () => {
    const learning = due('a', NOW + 5 * 60_000, { fsrs: { ...makeCard().fsrs, state: 1, due: NOW + 5 * 60_000 } })
    expect(forecast(entries, [learning], NOW, H)[0]?.count).toBe(1)
  })
})

describe('addedPerWeek', () => {
  it('starts every week on Monday, ends with the current one and lists 8 weeks', () => {
    const weeks = addedPerWeek([], NOW, H)
    expect(weeks).toHaveLength(8)
    expect(weeks[7]?.start).toBe('2026-10-26') // Wednesday 28 October: the week of Monday 26
    expect(weeks[0]?.start).toBe('2026-09-07')
    expect(weeks.every((week, index) => index === 0 || mondayOfKey(week.start) === week.start)).toBe(true)
  })

  it('counts the words of each week, archived ones included and deleted ones not', () => {
    const entries = [
      makeEntry({ createdAt: at(2026, 10, 28, 9) }),
      makeEntry({ createdAt: at(2026, 10, 26, 10) }),
      makeEntry({ createdAt: at(2026, 10, 25, 10), status: 'archived' }), // Sunday: the week before
      makeEntry({ createdAt: at(2026, 10, 20), deletedAt: 9 }),
      makeEntry({ createdAt: at(2026, 9, 7, 10) }),
      makeEntry({ createdAt: at(2026, 9, 6, 10) }), // the week before the first
    ]
    expect(addedPerWeek(entries, NOW, H).map((week) => week.count)).toEqual([1, 0, 0, 0, 0, 0, 1, 2])
  })

  it('counts Monday at 02:00 in the week that is ending, as the study day has not begun', () => {
    const entries = [makeEntry({ createdAt: at(2026, 10, 26, 2, 0) }), makeEntry({ createdAt: at(2026, 10, 26, 4, 0) })]
    const weeks = addedPerWeek(entries, NOW, H)
    expect(weeks[6]?.count).toBe(1)
    expect(weeks[7]?.count).toBe(1)
  })
})

describe('mostFailed', () => {
  const entries = ['a', 'b', 'c'].map((id) => makeEntry({ id, lemma: `word-${id}` }))
  const wrong = (entryId: string, when: number, overrides = {}) => makeLog({ entryId, at: when, correct: false, origin: 'review', ...overrides })

  it('lists the words by their wrong answers in regular reviews, the most recently failed first among equals', () => {
    const logs = [wrong('a', 10), wrong('a', 20), wrong('b', 30), wrong('b', 40), wrong('c', 50)]
    const list = mostFailed(logs, entries)
    expect(list.map((item) => [item.entry.id, item.fails])).toEqual([['b', 2], ['a', 2], ['c', 1]])
    expect(list[0]?.lastAt).toBe(40)
  })

  it('counts only regular reviews: not games, extra reviews, undone answers or right ones', () => {
    const logs = [
      wrong('a', 1),
      wrong('a', 2, { origin: 'game:match' }),
      wrong('a', 3, { origin: 'extra' }),
      wrong('a', 4, { deletedAt: 9 }),
      makeLog({ entryId: 'a', at: 5, correct: true, origin: 'review' }),
    ]
    expect(mostFailed(logs, entries).map((item) => [item.entry.id, item.fails])).toEqual([['a', 1]])
  })

  it('leaves out words that no longer exist and keeps to the top ten', () => {
    const many = Array.from({ length: 14 }, (_, i) => makeEntry({ id: `w${i}`, lemma: `w${i}` }))
    const logs = [...many.map((entry, i) => wrong(entry.id, i + 1)), wrong('ghost', 99)]
    const list = mostFailed(logs, many)
    expect(list).toHaveLength(FAILED_LIMIT)
    expect(list.some((item) => item.entry.id === 'ghost')).toBe(false)
    expect(mostFailed(logs, [makeEntry({ id: 'w0', lemma: 'w0', deletedAt: 1 })])).toEqual([])
  })

  it('has nothing to list before the first mistake', () => {
    expect(mostFailed([], entries)).toEqual([])
  })
})

describe('calendar helpers', () => {
  it('adds days by calendar, over months, years and the change of clocks', () => {
    expect(addDaysToKey('2026-10-28', 5)).toBe('2026-11-02')
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDaysToKey('2026-10-24', 2)).toBe('2026-10-26')
  })

  it('finds the Monday of a week, Sunday included', () => {
    expect(mondayOfKey('2026-10-26')).toBe('2026-10-26')
    expect(mondayOfKey('2026-10-28')).toBe('2026-10-26')
    expect(mondayOfKey('2026-11-01')).toBe('2026-10-26')
    expect(mondayOfKey('2026-11-02')).toBe('2026-11-02')
  })
})
