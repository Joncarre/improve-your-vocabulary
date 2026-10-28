import type { Card, Entry } from '../shared/index.ts'
import { retrievability } from '../srs/scheduler.ts'
import { isActiveCard } from '../srs/state.ts'
import { shuffle, weightedSample, type Rng } from './rng.ts'
import { RECENT_WORDS, type GameScope } from './scope.ts'

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS

/** A word a game can use, with its cards. */
export interface GameWord {
  entry: Entry
  /** The cards that have not been deleted. */
  cards: Card[]
  /** Answered at least once in a review (spec §8: the default for games). */
  seen: boolean
}

/** A word with a meaning to play with: not archived, not waiting for the AI and not deleted. */
export function isPlayable(entry: Entry): boolean {
  return entry.deletedAt === undefined && entry.status === 'active' && entry.senses.length > 0
}

/** The sense a game shows by default: the one of the sentence where the word was found. */
export function mainSense(entry: Entry) {
  return entry.senses.find((sense) => sense.matchesContext) ?? entry.senses[0]
}

export function buildWords(entries: readonly Entry[], cards: readonly Card[]): GameWord[] {
  const byEntry = new Map<string, Card[]>()
  for (const card of cards) {
    if (card.deletedAt !== undefined) continue
    byEntry.set(card.entryId, [...(byEntry.get(card.entryId) ?? []), card])
  }
  return entries.filter(isPlayable).map((entry) => {
    const own = byEntry.get(entry.id) ?? []
    return { entry, cards: own, seen: own.some((card) => card.stats.seen > 0) }
  })
}

/**
 * The words of a scope. Unless `includeNew`, only words answered at least once in a review (§8);
 * "Últimas añadidas" are the newest of those. A `focus` list keeps its words whatever their state.
 */
export function wordsInScope(words: readonly GameWord[], scope: GameScope, includeNew = false): GameWord[] {
  const usable = words.filter((word) => includeNew || word.seen)
  switch (scope.kind) {
    case 'all':
      return usable
    case 'topic':
      return usable.filter((word) => word.entry.topicIds.includes(scope.topicId))
    case 'source':
      return usable.filter((word) => word.entry.contexts.some((context) => context.sourceId === scope.sourceId))
    case 'leeches':
      return usable.filter((word) => word.entry.isLeech)
    case 'recent':
      return [...usable].sort((a, b) => b.entry.createdAt - a.entry.createdAt).slice(0, RECENT_WORDS)
    case 'focus': {
      const focus = new Set(scope.entryIds)
      const usableIds = new Set(usable.map((word) => word.entry.id))
      return words.filter((word) => focus.has(word.entry.id) || usableIds.has(word.entry.id))
    }
  }
}

export interface WeightContext {
  now: number
  desiredRetention: number
  /** When each word was last answered wrong, in any review or game. */
  failedAt: ReadonlyMap<string, number>
}

/**
 * How likely a word is to be chosen (spec §8): more for words with low retrievability, failed in the
 * last week, learnt this week (added in the last seven days) or "rebeldes".
 */
export function wordWeight(word: GameWord, context: WeightContext): number {
  const started = word.cards.filter((card) => isActiveCard(card) && card.fsrs.state !== 0)
  const recall = started.length > 0 ? Math.min(...started.map((card) => retrievability(card.fsrs, context.now, context.desiredRetention))) : 0.5
  let weight = 1 + 3 * (1 - Math.min(1, Math.max(0, recall)))
  const failed = context.failedAt.get(word.entry.id)
  if (failed !== undefined && failed >= context.now - WEEK_MS) weight += 2
  if (word.entry.createdAt >= context.now - WEEK_MS) weight += 1.5
  if (word.entry.isLeech) weight += 1
  return weight
}

export interface PickOptions extends WeightContext {
  rng: Rng
  /** Words that must come first (the ones failed in a review). */
  focusIds?: ReadonlySet<string>
  /** A multiplier on the weight, for games with their own priorities (irregular verbs first). */
  boost?: (word: GameWord) => number
}

/** Rounds in a game (spec §8: 10 rounds). A small scope gives fewer: a word is never asked twice in a game. */
export const MAX_ROUNDS = 10

/** All the words in the order they should be used: the focus words first, then the rest by a weighted draw. */
export function weightedOrder(words: readonly GameWord[], options: PickOptions): GameWord[] {
  const focus = shuffle(
    words.filter((word) => options.focusIds?.has(word.entry.id)),
    options.rng,
  )
  const rest = weightedSample(
    words.filter((word) => !options.focusIds?.has(word.entry.id)),
    (word) => wordWeight(word, options) * (options.boost?.(word) ?? 1),
    words.length,
    options.rng,
  )
  return [...focus, ...rest]
}

/** `count` different words in a random order, drawn with the weights (the focus words first). */
export function pickWords(words: readonly GameWord[], count: number, options: PickOptions): GameWord[] {
  return shuffle(weightedOrder(words, options).slice(0, count), options.rng)
}

/**
 * A round for each of up to `rounds` words. Words are tried in the order of the weighted draw, so the
 * heavier ones are the ones that play; a word that cannot make a round is skipped for the next one.
 * The rounds are shuffled at the end, so the order of play is random.
 */
export function planRounds<R>(words: readonly GameWord[], rounds: number, options: PickOptions, build: (word: GameWord) => R | null): R[] {
  const planned: R[] = []
  for (const word of weightedOrder(words, options)) {
    if (planned.length >= rounds) break
    const round = build(word)
    if (round) planned.push(round)
  }
  return shuffle(planned, options.rng)
}
