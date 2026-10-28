import type { ReviewLog } from '../shared/index.ts'
import { previousDayKey, studyDayKey } from './studyDay.ts'

export interface Streak {
  /** Consecutive study days with at least one review. */
  days: number
  doneToday: boolean
}

/**
 * The streak of days in a row with a review (a regular or an extra one; games do not count). A day
 * that has not been studied yet does not break it: it only ends once a whole day goes by.
 */
export function computeStreak(logs: readonly ReviewLog[], now: number, dayStartHour: number): Streak {
  const studied = new Set(
    logs
      .filter((log) => log.deletedAt === undefined && (log.origin === 'review' || log.origin === 'extra'))
      .map((log) => studyDayKey(log.at, dayStartHour)),
  )
  const today = studyDayKey(now, dayStartHour)
  const doneToday = studied.has(today)
  let key = doneToday ? today : previousDayKey(today)
  let days = 0
  while (studied.has(key)) {
    days += 1
    key = previousDayKey(key)
  }
  return { days, doneToday }
}

const DEFAULT_SECONDS_PER_CARD = 12
const MIN_SECONDS = 3
const MAX_SECONDS = 60

/** Minutes a session of `cards` cards takes, from how long the recent answers took (median), at least 1. */
export function estimateMinutes(cards: number, recentLogs: readonly Pick<ReviewLog, 'ms'>[]): number {
  if (cards <= 0) return 0
  const seconds = recentLogs.map((log) => log.ms / 1000).filter((value) => value > 0).sort((a, b) => a - b)
  const median = seconds.length >= 10 ? (seconds[Math.floor(seconds.length / 2)] ?? DEFAULT_SECONDS_PER_CARD) : DEFAULT_SECONDS_PER_CARD
  const perCard = Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, median))
  return Math.max(1, Math.round((cards * perCard) / 60))
}
