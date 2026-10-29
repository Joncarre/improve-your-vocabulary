import type { Card, Entry, ReviewLog } from '../../shared/index.ts'
import { State } from '../../srs/scheduler.ts'
import { entryState, isActiveCard, WORD_STATES, type WordState } from '../../srs/state.ts'
import { addDaysToKey, mondayOfKey, studyDayKey, studyDayStart } from '../../srs/studyDay.ts'

/*
 * The numbers of Progreso (spec §9), from the plain rows of the database. Only a regular review
 * (`origin: 'review'`) counts as a review: games and extra reviews practise a word but are not the
 * schedule, so they stay out of the daily counts, the accuracy and the failures.
 */

/** Days in the charts of reviews and accuracy. */
export const REVIEW_DAYS = 30
/** Days of the forecast, today included. */
export const FORECAST_DAYS = 7
/** Weeks in the chart of words added, the current one included. */
export const ADDED_WEEKS = 8
/** Words in the list of the most failed. */
export const FAILED_LIMIT = 10

const isReview = (log: ReviewLog) => log.deletedAt === undefined && log.origin === 'review'

/** The keys of `count` study days in a row, oldest first: those ending today (`back`) or starting today (`forward`). */
export function dayKeys(now: number, dayStartHour: number, count: number, direction: 'back' | 'forward' = 'back'): string[] {
  const today = studyDayKey(now, dayStartHour)
  return Array.from({ length: count }, (_, index) => addDaysToKey(today, direction === 'back' ? index - (count - 1) : index))
}

/* ---------- Reviews per day and accuracy ---------- */

export interface DayStat {
  /** The study day ("2026-10-28"). */
  key: string
  total: number
  correct: number
}

/** Regular reviews of each of the last `days` study days (the last one is today), with those answered right. */
export function reviewsPerDay(logs: readonly ReviewLog[], now: number, dayStartHour: number, days = REVIEW_DAYS): DayStat[] {
  const stats = new Map(dayKeys(now, dayStartHour, days).map((key) => [key, { key, total: 0, correct: 0 }]))
  for (const log of logs) {
    if (!isReview(log)) continue
    const stat = stats.get(studyDayKey(log.at, dayStartHour))
    if (!stat) continue
    stat.total += 1
    if (log.correct) stat.correct += 1
  }
  return [...stats.values()]
}

export interface Accuracy {
  correct: number
  total: number
  /** 0 to 1, or null before the first answer. */
  rate: number | null
}

export function accuracyOf(days: readonly DayStat[]): Accuracy {
  const total = days.reduce((sum, day) => sum + day.total, 0)
  const correct = days.reduce((sum, day) => sum + day.correct, 0)
  return { correct, total, rate: total > 0 ? correct / total : null }
}

/* ---------- Words by state ---------- */

/** A word that is part of the collection: not deleted, not archived and not waiting for the AI. */
const isLiveWord = (entry: Entry) => entry.deletedAt === undefined && entry.status === 'active'

function cardsByEntry(cards: readonly Card[]): Map<string, Card[]> {
  const byEntry = new Map<string, Card[]>()
  for (const card of cards) {
    if (card.deletedAt !== undefined) continue
    byEntry.set(card.entryId, [...(byEntry.get(card.entryId) ?? []), card])
  }
  return byEntry
}

/** How many words are in each state (the state of a word is the one of its weakest active card, spec §7). */
export function stateCounts(entries: readonly Entry[], cards: readonly Card[]): Record<WordState, number> {
  const byEntry = cardsByEntry(cards)
  const counts: Record<WordState, number> = { new: 0, learning: 0, review: 0, consolidated: 0, mastered: 0 }
  for (const entry of entries) if (isLiveWord(entry)) counts[entryState(byEntry.get(entry.id) ?? [])] += 1
  return counts
}

export const totalWords = (counts: Record<WordState, number>) => WORD_STATES.reduce((sum, state) => sum + counts[state], 0)

/* ---------- Forecast ---------- */

export interface ForecastDay {
  key: string
  count: number
}

/**
 * Cards to review on each of the next days, today first. What is overdue counts for today; new cards are
 * not scheduled (they come in through the daily limit) and so are not in it.
 */
export function forecast(entries: readonly Entry[], cards: readonly Card[], now: number, dayStartHour: number, days = FORECAST_DAYS): ForecastDay[] {
  const live = new Set(entries.filter(isLiveWord).map((entry) => entry.id))
  const counts = new Map(dayKeys(now, dayStartHour, days, 'forward').map((key) => [key, { key, count: 0 }]))
  const todayStart = studyDayStart(now, dayStartHour)
  const [today] = counts.keys()
  for (const card of cards) {
    if (!live.has(card.entryId) || !isActiveCard(card) || card.fsrs.state === State.New) continue
    const day = counts.get(card.due < todayStart && today !== undefined ? today : studyDayKey(card.due, dayStartHour))
    if (day) day.count += 1
  }
  return [...counts.values()]
}

/* ---------- Words added per week ---------- */

export interface WeekStat {
  /** The Monday the week starts on ("2026-10-26"). */
  start: string
  count: number
}

/** Words added in each of the last `weeks` weeks (Monday to Sunday), the current one last. Archived words were added too. */
export function addedPerWeek(entries: readonly Entry[], now: number, dayStartHour: number, weeks = ADDED_WEEKS): WeekStat[] {
  const thisWeek = mondayOfKey(studyDayKey(now, dayStartHour))
  const stats = new Map(Array.from({ length: weeks }, (_, index) => addDaysToKey(thisWeek, 7 * (index - (weeks - 1)))).map((start) => [start, { start, count: 0 }]))
  for (const entry of entries) {
    if (entry.deletedAt !== undefined) continue
    const week = stats.get(mondayOfKey(studyDayKey(entry.createdAt, dayStartHour)))
    if (week) week.count += 1
  }
  return [...stats.values()]
}

/* ---------- The most failed ---------- */

export interface FailedWord {
  entry: Entry
  fails: number
  /** When it was last failed, to settle ties: the more recent first. */
  lastAt: number
}

/** The words with most wrong answers in regular reviews, all time. */
export function mostFailed(logs: readonly ReviewLog[], entries: readonly Entry[], limit = FAILED_LIMIT): FailedWord[] {
  const byId = new Map(entries.filter((entry) => entry.deletedAt === undefined).map((entry) => [entry.id, entry]))
  const failed = new Map<string, { fails: number; lastAt: number }>()
  for (const log of logs) {
    if (!isReview(log) || log.correct || !byId.has(log.entryId)) continue
    const current = failed.get(log.entryId) ?? { fails: 0, lastAt: 0 }
    failed.set(log.entryId, { fails: current.fails + 1, lastAt: Math.max(current.lastAt, log.at) })
  }
  return [...failed.entries()]
    .flatMap(([id, value]) => {
      const entry = byId.get(id)
      return entry ? [{ entry, ...value }] : []
    })
    .sort((a, b) => b.fails - a.fails || b.lastAt - a.lastAt || a.entry.lemma.localeCompare(b.entry.lemma))
    .slice(0, limit)
}
