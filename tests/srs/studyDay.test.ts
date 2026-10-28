import { beforeAll, describe, expect, it } from 'vitest'
import { computeStreak, estimateMinutes } from '../../src/srs/streak.ts'
import { previousDayKey, studyDayEnd, studyDayKey, studyDayStart } from '../../src/srs/studyDay.ts'
import type { ReviewLog } from '../../src/shared/index.ts'

const HOUR = 3_600_000

beforeAll(() => {
  // The clocks change in Madrid on 2026-03-29 (23-hour day) and 2026-10-25 (25-hour day).
  process.env.TZ = 'Europe/Madrid'
})

const at = (year: number, month: number, day: number, hour = 0, minute = 0) => new Date(year, month - 1, day, hour, minute).getTime()

describe('study day (04:00 to 04:00)', () => {
  it('starts at 4 in the morning: 03:59 still belongs to the day before', () => {
    expect(studyDayStart(at(2026, 6, 10, 12), 4)).toBe(at(2026, 6, 10, 4))
    expect(studyDayStart(at(2026, 6, 10, 3, 59), 4)).toBe(at(2026, 6, 9, 4))
    expect(studyDayStart(at(2026, 6, 10, 4, 0), 4)).toBe(at(2026, 6, 10, 4))
    expect(studyDayKey(at(2026, 6, 10, 1), 4)).toBe('2026-06-09')
    expect(studyDayKey(at(2026, 6, 10, 23, 30), 4)).toBe('2026-06-10')
  })

  it('ends where the next one starts', () => {
    expect(studyDayEnd(at(2026, 6, 10, 12), 4)).toBe(at(2026, 6, 11, 4))
    expect(studyDayEnd(at(2026, 6, 10, 2), 4)).toBe(at(2026, 6, 10, 4))
  })

  it('follows the hour chosen in Ajustes', () => {
    expect(studyDayStart(at(2026, 6, 10, 5), 6)).toBe(at(2026, 6, 9, 6))
    expect(studyDayStart(at(2026, 6, 10, 0, 30), 0)).toBe(at(2026, 6, 10, 0))
  })

  it('lasts 23 hours when the clocks go forward during it and 25 when they go back', () => {
    // The change happens at 02:00-03:00, so it falls inside the study day that began the evening before.
    const spring = at(2026, 3, 28, 12)
    expect((studyDayEnd(spring, 4) - studyDayStart(spring, 4)) / HOUR).toBe(23)
    const autumn = at(2026, 10, 24, 12)
    expect((studyDayEnd(autumn, 4) - studyDayStart(autumn, 4)) / HOUR).toBe(25)
    // ...and the days that start after the change are 24 hours again
    expect((studyDayEnd(at(2026, 3, 29, 12), 4) - studyDayStart(at(2026, 3, 29, 12), 4)) / HOUR).toBe(24)
  })

  it('keeps the boundaries at 04:00 local time around the change', () => {
    // 03:30 on the night the clocks go forward is the night of the 28th
    expect(studyDayKey(at(2026, 3, 29, 3, 30), 4)).toBe('2026-03-28')
    expect(studyDayStart(at(2026, 3, 30, 10), 4)).toBe(at(2026, 3, 30, 4))
    expect(new Date(studyDayEnd(at(2026, 3, 29, 12), 4)).getHours()).toBe(4)
    expect(new Date(studyDayEnd(at(2026, 10, 25, 12), 4)).getHours()).toBe(4)
  })

  it('finds the day before by calendar, over month, year and leap day', () => {
    expect(previousDayKey('2026-03-01')).toBe('2026-02-28')
    expect(previousDayKey('2028-03-01')).toBe('2028-02-29')
    expect(previousDayKey('2027-01-01')).toBe('2026-12-31')
  })
})

const log = (when: number, origin: ReviewLog['origin'] = 'review', extra: Partial<ReviewLog> = {}): ReviewLog => ({
  id: `l${when}${origin}`,
  cardId: 'c',
  entryId: 'e',
  at: when,
  origin,
  correct: true,
  ms: 5000,
  updatedAt: when,
  ...extra,
})

describe('computeStreak', () => {
  const now = at(2026, 6, 10, 15)

  it('counts the days in a row, today included', () => {
    const logs = [log(at(2026, 6, 10, 9)), log(at(2026, 6, 9, 20)), log(at(2026, 6, 8, 11))]
    expect(computeStreak(logs, now, 4)).toEqual({ days: 3, doneToday: true })
  })

  it('does not lose the streak just because today has not been studied yet', () => {
    expect(computeStreak([log(at(2026, 6, 9, 20)), log(at(2026, 6, 8, 11))], now, 4)).toEqual({ days: 2, doneToday: false })
  })

  it('ends after a whole day without studying', () => {
    expect(computeStreak([log(at(2026, 6, 8, 11))], now, 4)).toEqual({ days: 0, doneToday: false })
    expect(computeStreak([log(at(2026, 6, 10, 9)), log(at(2026, 6, 8, 11))], now, 4).days).toBe(1)
  })

  it('counts a late-night session on the day it belongs to', () => {
    // 01:30 on the 10th is still the study day of the 9th
    expect(computeStreak([log(at(2026, 6, 10, 1, 30)), log(at(2026, 6, 9, 10))], now, 4)).toEqual({ days: 1, doneToday: false })
  })

  it('counts extra reviews but not games or deleted answers', () => {
    expect(computeStreak([log(at(2026, 6, 10, 9), 'extra')], now, 4).days).toBe(1)
    expect(computeStreak([log(at(2026, 6, 10, 9), 'game:match')], now, 4).days).toBe(0)
    expect(computeStreak([log(at(2026, 6, 10, 9), 'review', { deletedAt: 1 })], now, 4).days).toBe(0)
  })

  it('keeps counting across the change of hour', () => {
    const logs = [log(at(2026, 3, 30, 9)), log(at(2026, 3, 29, 9)), log(at(2026, 3, 28, 9))]
    expect(computeStreak(logs, at(2026, 3, 30, 20), 4).days).toBe(3)
  })
})

describe('estimateMinutes', () => {
  it('uses 12 seconds a card until there is history, never less than a minute', () => {
    expect(estimateMinutes(0, [])).toBe(0)
    expect(estimateMinutes(1, [])).toBe(1)
    expect(estimateMinutes(30, [])).toBe(6)
  })

  it('uses the median of the recent answers once there are enough', () => {
    const slow = Array.from({ length: 20 }, () => ({ ms: 30_000 }))
    expect(estimateMinutes(20, slow)).toBe(10)
    const outliers = [...Array.from({ length: 19 }, () => ({ ms: 6000 })), { ms: 600_000 }]
    expect(estimateMinutes(20, outliers)).toBe(2) // the single very slow answer does not move it
  })
})
