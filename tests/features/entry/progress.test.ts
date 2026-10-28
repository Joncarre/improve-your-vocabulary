import { describe, expect, it } from 'vitest'
import { formatDue, lastAttempts, summarizeProgress } from '../../../src/features/entry/progress.ts'
import type { ReviewLog } from '../../../src/shared/index.ts'
import { makeCard } from '../../factories.ts'

const reviewCard = (stats: Partial<ReturnType<typeof makeCard>['stats']>, fsrs: Partial<ReturnType<typeof makeCard>['fsrs']> = {}, extra = {}) => {
  const base = makeCard()
  return makeCard({
    fsrs: { ...base.fsrs, state: 2, stability: 10, ...fsrs },
    stats: { ...base.stats, ...stats },
    ...extra,
  })
}

describe('summarizeProgress', () => {
  it('is empty for a word that has not started', () => {
    expect(summarizeProgress([makeCard()])).toEqual({
      state: 'new',
      seen: 0,
      correct: 0,
      wrong: 0,
      accuracy: null,
      streak: 0,
      nextDue: null,
    })
  })

  it('adds up both cards, takes the weakest streak and the earliest due date', () => {
    const recognition = reviewCard({ seen: 10, correct: 8, wrong: 2, streak: 6 }, {}, { due: 5_000 })
    const production = reviewCard({ seen: 4, correct: 1, wrong: 3, streak: 1 }, { state: 1 }, { type: 'production', due: 3_000 })

    expect(summarizeProgress([recognition, production])).toEqual({
      state: 'learning',
      seen: 14,
      correct: 9,
      wrong: 5,
      accuracy: 9 / 14,
      streak: 1,
      nextDue: 3_000,
    })
  })

  it('does not wait for a production card that is still locked', () => {
    const recognition = reviewCard({ seen: 3, correct: 3, streak: 3 }, {}, { due: 8_000 })
    const locked = makeCard({ type: 'production', unlocked: false, due: 1 })

    expect(summarizeProgress([recognition, locked])).toMatchObject({ state: 'review', streak: 3, nextDue: 8_000 })
  })

  it('ignores deleted cards', () => {
    const live = reviewCard({ seen: 2, correct: 2, streak: 2 })
    const deleted = reviewCard({ seen: 50, correct: 0, wrong: 50 }, {}, { deletedAt: 9 })

    expect(summarizeProgress([live, deleted])).toMatchObject({ seen: 2, wrong: 0 })
  })
})

describe('formatDue', () => {
  const now = 1_000_000_000_000
  const minutes = (n: number) => n * 60_000
  const hours = (n: number) => minutes(n * 60)
  const days = (n: number) => hours(n * 24)

  it.each([
    [-5_000, 'ahora'],
    [0, 'ahora'],
    [minutes(10), 'en 10 min'],
    [10_000, 'en 1 min'],
    [hours(3), 'en 3 h'],
    [days(1), 'en 1 día'],
    [days(12), 'en 12 días'],
    [days(90), 'en 3 meses'],
  ])('%d ms from now -> %s', (offset, expected) => {
    expect(formatDue(now + offset, now)).toBe(expected)
  })
})

describe('lastAttempts', () => {
  const log = (at: number, correct: boolean, extra: Partial<ReviewLog> = {}): ReviewLog => ({
    id: `l${at}`,
    cardId: 'c',
    entryId: 'e',
    at,
    origin: 'review',
    correct,
    ms: 1000,
    updatedAt: at,
    ...extra,
  })

  it('returns the last ten answers, oldest first', () => {
    const logs = Array.from({ length: 14 }, (_, i) => log(i + 1, i % 2 === 0))

    const attempts = lastAttempts(logs)

    expect(attempts).toHaveLength(10)
    // Answers 5..14 (at = 5..14): correct when the index is even, so at = 5 is true.
    expect(attempts).toEqual([true, false, true, false, true, false, true, false, true, false])
  })

  it('does not depend on the order the logs come in', () => {
    expect(lastAttempts([log(3, true), log(1, false), log(2, false)])).toEqual([false, false, true])
  })

  it('skips deleted answers and copes with none', () => {
    expect(lastAttempts([log(1, true), log(2, false, { deletedAt: 9 })])).toEqual([true])
    expect(lastAttempts([])).toEqual([])
  })
})
