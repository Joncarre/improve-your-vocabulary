import type { Cefr, Entry, Story, StoryPayloadInput, StoryTarget } from '../shared/index.ts'
import { normalizeAnswer } from '../srs/checker.ts'
import { shuffle, type Rng } from './rng.ts'
import { mainSense, wordWeight, type GameWord, type PickOptions } from './words.ts'

/** A story uses 6 to 8 words (spec §8). */
export const STORY_MIN_WORDS = 6
export const STORY_MAX_WORDS = 8

/** The words a new story is about: the weakest ones, the words failed in a review first. The weights get a small random push, so words that are about equally weak take turns. */
export function weakestWords(words: readonly GameWord[], pick: PickOptions): GameWord[] {
  const score = (word: GameWord) => (pick.focusIds?.has(word.entry.id) ? 100 : 0) + wordWeight(word, pick) + pick.rng() * 0.25
  return words
    .map((word) => ({ word, score: score(word) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, STORY_MAX_WORDS)
    .map(({ word }) => word)
}

const LEVELS: readonly Cefr[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/** The level the story is written at: the middle one of the words (B1 when none of them has one). */
export function storyLevel(entries: readonly Entry[]): Cefr {
  const known = entries.flatMap((entry) => (entry.cefr ? [LEVELS.indexOf(entry.cefr)] : [])).sort((a, b) => a - b)
  return LEVELS[known[Math.floor(known.length / 2)] ?? LEVELS.indexOf('B1')] ?? 'B1'
}

export function storyRequest(entries: readonly Entry[]): StoryPayloadInput {
  return {
    words: entries.map((entry) => ({ lemma: entry.lemma, pos: mainSense(entry)?.pos ?? 'noun' })),
    level: storyLevel(entries),
  }
}

/**
 * A story that was made but not played, to use before asking for another. It must still have enough of its words
 * (they could have been archived or deleted) and most of them must belong to the scope being played.
 */
export function findReusableStory(stories: readonly Story[], playableIds: ReadonlySet<string>, scopeIds: ReadonlySet<string>): Story | undefined {
  return [...stories]
    .filter((story) => story.deletedAt === undefined && story.playedAt === undefined)
    .sort((a, b) => b.createdAt - a.createdAt)
    .find((story) => {
      const alive = story.entryIds.filter((id) => playableIds.has(id))
      return alive.length >= STORY_MIN_WORDS && alive.filter((id) => scopeIds.has(id)).length * 2 > alive.length
    })
}

/* ---------- Gaps ---------- */

/** A word of the story: where it is in the text, what fills the gap, and the entry it belongs to. */
export interface StoryGap {
  index: number
  entry: Entry
  /** The word as it is written in the text ("went"). */
  answer: string
  start: number
  end: number
}

/** The words of a stored story that can still be played, in reading order. */
export function storyGaps(story: Pick<Story, 'textEn' | 'targets' | 'entryIds'>, entries: readonly Entry[]): StoryGap[] {
  const own = entries.filter((entry) => story.entryIds.includes(entry.id))
  const placed: Omit<StoryGap, 'index'>[] = story.targets.flatMap((target: StoryTarget) => {
    const entry = own.find((candidate) => normalizeAnswer(candidate.lemma) === normalizeAnswer(target.lemma))
    const answer = story.textEn.slice(target.start, target.end)
    return entry && answer ? [{ entry, answer, start: target.start, end: target.end }] : []
  })
  return placed.sort((a, b) => a.start - b.start).map((gap, index) => ({ ...gap, index }))
}

export type StorySegment = { kind: 'text'; text: string } | { kind: 'word'; gap: StoryGap }

/** The text cut at every word: the pieces between them and the words themselves, in order. */
export function storySegments(text: string, gaps: readonly StoryGap[]): StorySegment[] {
  const segments: StorySegment[] = []
  let at = 0
  for (const gap of gaps) {
    if (gap.start > at) segments.push({ kind: 'text', text: text.slice(at, gap.start) })
    segments.push({ kind: 'word', gap })
    at = gap.end
  }
  if (at < text.length) segments.push({ kind: 'text', text: text.slice(at) })
  return segments
}

export interface BankWord {
  id: string
  text: string
}

/** The words of the bank, shuffled; each is the answer of one gap. */
export function buildBank(gaps: readonly StoryGap[], rng: Rng): BankWord[] {
  return shuffle(
    gaps.map((gap) => ({ id: `w${gap.index}`, text: gap.answer })),
    rng,
  )
}

/** Whether the word placed in a gap is right: the same word counts wherever it came from, and the case does not matter. */
export function isGapRight(gap: StoryGap, placed: string | undefined): boolean {
  return placed !== undefined && normalizeAnswer(placed) === normalizeAnswer(gap.answer)
}
