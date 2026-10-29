import { db } from '../../db/db.ts'
import { listActive } from '../../db/repo.ts'
import { loadSharedSettings } from '../../db/settings.ts'
import type { WordState } from '../../srs/state.ts'
import { computeStreak, type Streak } from '../../srs/streak.ts'
import {
  accuracyOf,
  addedPerWeek,
  forecast,
  mostFailed,
  reviewsPerDay,
  stateCounts,
  totalWords,
  type Accuracy,
  type DayStat,
  type FailedWord,
  type ForecastDay,
  type WeekStat,
} from './stats.ts'

const DAY = 86_400_000
/** How far back the days and the streak are read: enough for any streak that matters, cheap to read (as in Hoy). */
const LOOKBACK_DAYS = 400

/** Everything Progreso shows, read together at one moment so the screen updates as one. */
export interface ProgressData {
  /** Words in the collection (not archived, not waiting for the AI). */
  words: number
  /** Every entry that was ever added and not deleted, archived ones included. */
  added: number
  streak: Streak
  days: DayStat[]
  accuracy: Accuracy
  states: Record<WordState, number>
  forecast: ForecastDay[]
  weeks: WeekStat[]
  failed: FailedWord[]
}

export async function loadProgress(now = Date.now()): Promise<ProgressData> {
  const [entries, cards, shared, recent, failedLogs] = await Promise.all([
    listActive('entries'),
    listActive('cards'),
    loadSharedSettings(),
    db.logs.where('at').above(now - LOOKBACK_DAYS * DAY).toArray(),
    // Every wrong regular review, all time: the right ones are left out so the read stays small.
    db.logs
      .where('origin')
      .equals('review')
      .filter((log) => !log.correct && log.deletedAt === undefined)
      .toArray(),
  ])
  const { dayStartHour } = shared
  const days = reviewsPerDay(recent, now, dayStartHour)
  const states = stateCounts(entries, cards)
  return {
    words: totalWords(states),
    added: entries.length,
    streak: computeStreak(recent, now, dayStartHour),
    days,
    accuracy: accuracyOf(days),
    states,
    forecast: forecast(entries, cards, now, dayStartHour),
    weeks: addedPerWeek(entries, now, dayStartHour),
    failed: mostFailed(failedLogs, entries),
  }
}
