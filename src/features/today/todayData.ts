import { db } from '../../db/db.ts'
import { listActive } from '../../db/repo.ts'
import { suggestGame, type GameSuggestion } from '../../games/suggestion.ts'
import { buildWords } from '../../games/words.ts'
import { computeStreak, estimateMinutes, type Streak } from '../../srs/streak.ts'
import { isActiveCard } from '../../srs/state.ts'
import { loadStudySnapshot, queueFromSnapshot } from '../../srs/studyData.ts'
import type { QueueResult } from '../../srs/queue.ts'

const DAY = 86_400_000
/** How far back to look for the streak: enough for any streak that matters, cheap to read. */
const STREAK_LOOKBACK_DAYS = 400

export interface TodayData {
  queue: QueueResult
  streak: Streak
  /** Estimated minutes for what is queued. */
  minutes: number
  /** Words that are not archived (0 means the collection is empty). */
  words: number
  leeches: number
  pending: number
  /** When the next card falls due, if nothing is due now. */
  nextDue: number | null
  /** The game Hoy suggests, when one can be played with the words already seen. */
  game: GameSuggestion | null
}

/** What the Hoy screen shows, read together so it updates as one. */
export async function loadToday(now = Date.now()): Promise<TodayData> {
  const snapshot = await loadStudySnapshot(now)
  const queue = queueFromSnapshot(snapshot, now)
  const { dayStartHour } = snapshot.shared

  const [recentLogs, answered, topics, sources] = await Promise.all([
    db.logs.orderBy('at').reverse().limit(200).toArray(),
    db.logs.where('at').above(now - STREAK_LOOKBACK_DAYS * DAY).toArray(),
    listActive('topics'),
    listActive('sources'),
  ])
  const total = queue.counts.learning + queue.counts.review + queue.counts.new
  const entries = snapshot.entries.filter((entry) => entry.status !== 'archived')
  const pendingCards = snapshot.cards.filter((card) => isActiveCard(card) && card.fsrs.state !== 0 && card.due > now)

  return {
    queue,
    streak: computeStreak(answered, now, dayStartHour),
    minutes: estimateMinutes(total, recentLogs.filter((log) => log.deletedAt === undefined && log.origin === 'review')),
    words: entries.length,
    leeches: entries.filter((entry) => entry.isLeech).length,
    pending: entries.filter((entry) => entry.status === 'pending_ai').length,
    nextDue: pendingCards.length > 0 ? Math.min(...pendingCards.map((card) => card.due)) : null,
    game: suggestGame(buildWords(snapshot.entries, snapshot.cards), now, dayStartHour, { topics, sources }),
  }
}
