import { db } from '../db/db.ts'
import { writeRecord } from '../db/repo.ts'
import { newId } from '../lib/id.ts'
import type { Card, GameId, GameResult, ReviewLog } from '../shared/index.ts'
import { State } from '../srs/scheduler.ts'
import { updatedStats } from '../srs/review.ts'
import { isActiveCard } from '../srs/state.ts'
import { studyDayEnd } from '../srs/studyDay.ts'

export interface GameAnswer {
  entryId: string
  correct: boolean
  /** How long the answer took, in milliseconds. */
  ms: number
}

export interface RecordOptions {
  /** The card the answer counts for when the word has both: games that ask for English use the written one. */
  prefer: Card['type']
  dayStartHour: number
  now?: number
}

/**
 * A wrong answer in a game brings a card that was due later back to today (spec §8); a right answer
 * leaves the calendar alone, so games cannot inflate the algorithm. Only cards in review move:
 * a card still learning, or a new one, is already due soon.
 */
export function broughtToToday(card: Card, now: number, dayStartHour: number): Card {
  if (card.fsrs.state !== State.Review || card.due <= studyDayEnd(now, dayStartHour)) return card
  return { ...card, due: now, fsrs: { ...card.fsrs, due: now } }
}

/**
 * Saves an answer from a game in one transaction: the statistics of the word's card, a log with
 * origin `game:<id>` and, after a mistake, the calendar effect above. Resolves to false when the word
 * has no card in play any more (archived or deleted while the game was open).
 */
export async function recordGameAnswer(game: GameId, answer: GameAnswer, options: RecordOptions): Promise<boolean> {
  const at = options.now ?? Date.now()
  return db.transaction('rw', [db.cards, db.logs, db.outbox], async () => {
    const cards = (await db.cards.where('entryId').equals(answer.entryId).toArray()).filter(isActiveCard)
    const card = cards.find((candidate) => candidate.type === options.prefer) ?? cards[0]
    if (!card) return false

    const next: Card = { ...card, stats: updatedStats(card, answer.correct, at) }
    await writeRecord('cards', answer.correct ? next : broughtToToday(next, at, options.dayStartHour), { now: at })
    const log: ReviewLog = {
      id: newId(),
      cardId: card.id,
      entryId: card.entryId,
      at,
      origin: `game:${game}`,
      correct: answer.correct,
      ms: Math.max(0, Math.round(answer.ms)),
      updatedAt: at,
    }
    await writeRecord('logs', log, { now: at })
    return true
  })
}

export interface ResultInput {
  game: GameId
  score: number
  total: number
  durationMs: number
  variant?: string
  now?: number
}

export async function saveGameResult(input: ResultInput): Promise<GameResult> {
  const at = input.now ?? Date.now()
  const result: GameResult = {
    id: newId(),
    game: input.game,
    at,
    score: input.score,
    total: input.total,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    ...(input.variant === undefined ? {} : { variant: input.variant }),
    updatedAt: at,
  }
  return writeRecord('games', result, { now: at })
}

/**
 * Whether `a` beats `b`. Parejas is a race: the shortest time wins. The other games compare the share of
 * right answers and, when it is the same, the shorter time.
 */
export function isBetterResult(game: GameId, a: Pick<GameResult, 'score' | 'total' | 'durationMs'>, b: Pick<GameResult, 'score' | 'total' | 'durationMs'>): boolean {
  if (game === 'match') return a.durationMs < b.durationMs
  const share = (result: Pick<GameResult, 'score' | 'total'>) => (result.total > 0 ? result.score / result.total : 0)
  return share(a) > share(b) || (share(a) === share(b) && a.durationMs < b.durationMs)
}

/** The personal record of a game and variant (a result without variant belongs to every variant). */
export async function loadBestResult(game: GameId, variant: string | undefined): Promise<GameResult | undefined> {
  const results = await db.games.where('game').equals(game).toArray()
  return results
    .filter((result) => result.deletedAt === undefined && (variant === undefined || result.variant === undefined || result.variant === variant))
    .reduce<GameResult | undefined>((best, result) => (!best || isBetterResult(game, result, best) ? result : best), undefined)
}

/** How many times each word has been answered in a game: the sentence or the kind of round rotates with it. */
export async function loadGameTurns(game: GameId): Promise<Map<string, number>> {
  const logs = await db.logs.where('origin').equals(`game:${game}`).toArray()
  const turns = new Map<string, number>()
  for (const log of logs) if (log.deletedAt === undefined) turns.set(log.entryId, (turns.get(log.entryId) ?? 0) + 1)
  return turns
}
