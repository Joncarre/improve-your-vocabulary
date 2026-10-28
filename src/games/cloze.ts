import type { Entry } from '../shared/index.ts'
import { normalizeAnswer } from '../srs/checker.ts'
import { buildCloze, buildExamplePool, senseOfExample, type Cloze, type ExampleItem } from '../srs/examples.ts'
import { formCategory, pickDistractors } from './distractors.ts'
import { shuffle, type Rng } from './rng.ts'
import { MAX_ROUNDS, planRounds, type GameWord, type PickOptions } from './words.ts'

/** Level 1 chooses among four options; level 2 writes the answer (spec §8). */
export type ClozeLevel = 'choose' | 'type'

/** One answer and three wrong options. */
export const CLOZE_OPTIONS = 4

export interface ClozeRound {
  entry: Entry
  before: string
  /** The word as written in the sentence ("went"). */
  answer: string
  after: string
  /** Everything that counts as right (spelling variants and verb variants included). */
  accepted: string[]
  translationEs: string
  /** The options in the order shown, with the answer among them; empty when the answer is written. */
  options: string[]
  /** True when the sentence is one the user found, not an example. */
  own: boolean
}

interface Gap {
  item: ExampleItem
  cloze: Cloze
}

/** The sentences of a word where the word can be taken out: the user's own first, then the examples of every sense. */
function gapsOf(entry: Entry): Gap[] {
  return buildExamplePool(entry).flatMap((item) => {
    const cloze = buildCloze(entry, item)
    return cloze ? [{ item, cloze }] : []
  })
}

/** Whether the word has at least one sentence with a gap. */
export function hasClozeGap(entry: Entry): boolean {
  return gapsOf(entry).length > 0
}

export interface ClozeContext {
  level: ClozeLevel
  /** Every playable word, for the wrong options. */
  pool: readonly Entry[]
  /** Times this word has been played in this game: the sentence rotates with it, so it is not always the same one. */
  turn: number
  rng: Rng
}

/** The gap for one word, or null when no sentence fits or the collection is too small for four options. */
export function buildClozeRound(entry: Entry, context: ClozeContext): ClozeRound | null {
  const gaps = gapsOf(entry)
  const chosen = gaps[((context.turn % gaps.length) + gaps.length) % gaps.length]
  if (!chosen) return null
  const { item, cloze } = chosen

  const round: ClozeRound = {
    entry,
    before: cloze.before,
    answer: cloze.answer,
    after: cloze.after,
    accepted: cloze.accepted,
    translationEs: item.translationEs,
    options: [],
    own: item.origin === 'context',
  }
  if (context.level === 'type') return round

  const wrong = pickDistractors({
    target: entry,
    pos: senseOfExample(entry, item)?.pos ?? 'noun',
    category: formCategory(entry, cloze.answer),
    accepted: cloze.accepted,
    pool: context.pool,
    count: CLOZE_OPTIONS - 1,
    rng: context.rng,
  })
  if (wrong.length < CLOZE_OPTIONS - 1) return null
  return { ...round, options: shuffle([cloze.answer, ...wrong], context.rng) }
}

export function isClozeAnswer(round: ClozeRound, option: string): boolean {
  return round.accepted.some((accepted) => normalizeAnswer(accepted) === normalizeAnswer(option))
}

export interface ClozePlan {
  level: ClozeLevel
  pool: readonly Entry[]
  /** Times each word has been played in this game before. */
  turns: ReadonlyMap<string, number>
  pick: PickOptions
}

/** The rounds of a game: up to ten words, each with a sentence and, in level 1, four options. */
export function planCloze(words: readonly GameWord[], plan: ClozePlan): ClozeRound[] {
  return planRounds(
    words.filter((word) => hasClozeGap(word.entry)),
    MAX_ROUNDS,
    plan.pick,
    (word) => buildClozeRound(word.entry, { level: plan.level, pool: plan.pool, turn: plan.turns.get(word.entry.id) ?? 0, rng: plan.pick.rng }),
  )
}
