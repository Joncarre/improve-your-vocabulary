import { findHighlightTarget } from '../lib/highlight.ts'
import type { Entry } from '../shared/index.ts'
import { damerauLevenshtein, diffParts, normalizeAnswer, type DiffPart } from '../srs/checker.ts'
import { buildExamplePool, type ExampleItem } from '../srs/examples.ts'
import { spellingVariants } from '../srs/variants.ts'
import { MAX_ROUNDS, planRounds, type GameWord, type PickOptions } from './words.ts'

/** A "short" sentence for listening: this many words at most (a longer one is only used when the word has no other). */
export const SHORT_SENTENCE_WORDS = 12

export interface DictationSentence {
  text: string
  translationEs: string
  /** The word as written in the sentence, to highlight it. */
  target: string | undefined
}

export interface DictationRound {
  entry: Entry
  /** What is spoken first and what has to be written: the word as it is in the dictionary (British spelling). */
  answer: string
  /** A short sentence that uses the word, spoken after it; none when the word has no example. */
  sentence: DictationSentence | null
}

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

/** The sentences of a word that can be listened to, short ones first in the order of the pool, then the shortest of the rest. */
function sentencesOf(entry: Entry): ExampleItem[] {
  const usable = buildExamplePool(entry).filter((item) => findHighlightTarget(item.sentence, entry, item.target) !== undefined)
  const short = usable.filter((item) => wordCount(item.sentence) <= SHORT_SENTENCE_WORDS)
  if (short.length > 0) return short
  const shortest = [...usable].sort((a, b) => wordCount(a.sentence) - wordCount(b.sentence))[0]
  return shortest ? [shortest] : []
}

/** The round for one word. The sentence goes round the short ones as the word is played again. */
export function buildDictationRound(entry: Entry, turn: number): DictationRound | null {
  const answer = entry.lemma.trim()
  if (!answer) return null
  const sentences = sentencesOf(entry)
  const chosen = sentences[((turn % sentences.length) + sentences.length) % sentences.length]
  return {
    entry,
    answer,
    sentence: chosen ? { text: chosen.sentence, translationEs: chosen.translationEs, target: findHighlightTarget(chosen.sentence, entry, chosen.target) } : null,
  }
}

/**
 * `right` is the only one that counts. Dictation is about spelling, and about British spelling (decision B12):
 * a slip is a mistake that shows where it was, and the American spelling is a mistake that says what to write.
 */
export interface DictationVerdict {
  verdict: 'right' | 'american' | 'typo' | 'wrong' | 'empty'
  correct: boolean
  expected: string
  /** For a slip: what was typed and what was expected, with the different letters marked. */
  diff?: { typed: DiffPart[]; expected: DiffPart[] }
}

const TYPO_MIN_LENGTH = 5

export function judgeDictation(round: Pick<DictationRound, 'answer'>, typed: string): DictationVerdict {
  const expected = round.answer
  const key = normalizeAnswer(typed)
  const wanted = normalizeAnswer(expected)
  if (!key) return { verdict: 'empty', correct: false, expected }
  if (key === wanted) return { verdict: 'right', correct: true, expected }
  if (spellingVariants(wanted).includes(key)) return { verdict: 'american', correct: false, expected }
  if (wanted.length >= TYPO_MIN_LENGTH && damerauLevenshtein(key, wanted) === 1) {
    return { verdict: 'typo', correct: false, expected, diff: diffParts(key, wanted) }
  }
  return { verdict: 'wrong', correct: false, expected }
}

export interface DictationPlan {
  turns: ReadonlyMap<string, number>
  pick: PickOptions
}

/** Up to ten rounds, the weakest words first. */
export function planDictation(words: readonly GameWord[], plan: DictationPlan): DictationRound[] {
  return planRounds(words, MAX_ROUNDS, plan.pick, (word) => buildDictationRound(word.entry, plan.turns.get(word.entry.id) ?? 0))
}
