import { cardState, entryState, isActiveCard, WORD_STATES, type WordState } from '../../srs/state.ts'
import type { Card, ReviewLog } from '../../shared/index.ts'

export interface ProgressSummary {
  state: WordState
  seen: number
  correct: number
  wrong: number
  /** 0-1, or null before the first answer. */
  accuracy: number | null
  /** Current streak: the weakest of the active cards. */
  streak: number
  /** When the next review is due (ms), or null for a word that has not started yet. */
  nextDue: number | null
}

/** Numbers for the "Progreso" section of the entry page, from the entry's cards. */
export function summarizeProgress(cards: readonly Card[]): ProgressSummary {
  const live = cards.filter((card) => card.deletedAt === undefined)
  const active = live.filter(isActiveCard)
  const seen = live.reduce((sum, card) => sum + card.stats.seen, 0)
  const correct = live.reduce((sum, card) => sum + card.stats.correct, 0)
  const wrong = live.reduce((sum, card) => sum + card.stats.wrong, 0)
  const started = active.filter((card) => WORD_STATES.indexOf(cardState(card)) > 0)
  const dues = started.map((card) => card.due)

  return {
    state: entryState(cards),
    seen,
    correct,
    wrong,
    accuracy: correct + wrong > 0 ? correct / (correct + wrong) : null,
    streak: active.length > 0 ? Math.min(...active.map((card) => card.stats.streak)) : 0,
    nextDue: dues.length > 0 ? Math.min(...dues) : null,
  }
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** "ahora", "en 10 min", "en 3 h", "en 12 días", "en 3 meses". */
export function formatDue(due: number, now: number): string {
  const diff = due - now
  if (diff <= 0) return 'ahora'
  if (diff < HOUR) return `en ${Math.max(1, Math.round(diff / MINUTE))} min`
  if (diff < DAY) return `en ${Math.round(diff / HOUR)} h`
  const days = Math.round(diff / DAY)
  if (days < 60) return days === 1 ? 'en 1 día' : `en ${days} días`
  return `en ${Math.round(days / 30)} meses`
}

/** The last answers of a word as right (true) or wrong (false), oldest first, at most `limit`. */
export function lastAttempts(logs: readonly ReviewLog[], limit = 10): boolean[] {
  return logs
    .filter((log) => log.deletedAt === undefined)
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
    .reverse()
    .map((log) => log.correct)
}
