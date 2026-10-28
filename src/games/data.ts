import { db } from '../db/db.ts'
import { listActive } from '../db/repo.ts'
import { loadSharedSettings } from '../db/settings.ts'
import type { Card, Entry, Source, Topic } from '../shared/index.ts'
import { buildWords, type GameWord } from './words.ts'

const WEEK_MS = 7 * 86_400_000

/** What the games screens need from the database, read together at one moment. */
export interface GameData {
  entries: Entry[]
  cards: Card[]
  topics: Topic[]
  sources: Source[]
  /** Every playable word with its cards. */
  words: GameWord[]
  /** When each word was last answered wrong (in the last week), in any review or game. */
  failedAt: Map<string, number>
  desiredRetention: number
  dayStartHour: number
  now: number
}

export async function loadGameData(now = Date.now()): Promise<GameData> {
  const [entries, cards, topics, sources, shared, recent] = await Promise.all([
    listActive('entries'),
    listActive('cards'),
    listActive('topics'),
    listActive('sources'),
    loadSharedSettings(),
    db.logs.where('at').above(now - WEEK_MS).toArray(),
  ])
  const failedAt = new Map<string, number>()
  for (const log of recent) {
    if (log.deletedAt !== undefined || log.correct || log.origin === 'extra') continue
    failedAt.set(log.entryId, Math.max(failedAt.get(log.entryId) ?? 0, log.at))
  }
  return {
    entries,
    cards,
    topics,
    sources,
    words: buildWords(entries, cards),
    failedAt,
    desiredRetention: shared.desiredRetention,
    dayStartHour: shared.dayStartHour,
    now,
  }
}
