import type { Entry } from '../shared/index.ts'
import { spellingVariants } from './variants.ts'

/** Lower case, straight apostrophes and quotes, single spaces, no surrounding punctuation. */
export function normalizeAnswer(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'([{¿¡-]+|[\s"')\]}.,;:!?…-]+$/gu, '')
    .trim()
}

/** Damerau-Levenshtein distance (optimal string alignment): insertions, deletions, substitutions and swaps of two neighbours. */
export function damerauLevenshtein(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  const table: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let best = Math.min(
        (table[i - 1]?.[j] ?? 0) + 1,
        (table[i]?.[j - 1] ?? 0) + 1,
        (table[i - 1]?.[j - 1] ?? 0) + cost,
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, (table[i - 2]?.[j - 2] ?? 0) + 1)
      }
      const row = table[i]
      if (row) row[j] = best
    }
  }
  return table[rows - 1]?.[cols - 1] ?? 0
}

/** Exact match needs `exact`; one slip needs a word longer than this many letters (spec §7: more than 4). */
const TYPO_MIN_LENGTH = 5

export interface DiffPart {
  text: string
  changed: boolean
}

export interface CheckResult {
  verdict: 'exact' | 'typo' | 'wrong' | 'empty'
  /** The rating the app proposes: 3 Good, 2 Hard (one slip), 1 Again; none when nothing was typed. */
  suggestedGrade: 1 | 2 | 3 | null
  /** The accepted answer closest to what was typed (the first one when nothing is close). */
  expected: string
  /** For a typo: what was typed and what was expected, with the different letters marked. */
  diff?: { typed: DiffPart[]; expected: DiffPart[] }
}

/** Marks the stretch in the middle where two strings differ, keeping what they share at both ends. */
export function diffParts(typed: string, expected: string): { typed: DiffPart[]; expected: DiffPart[] } {
  let start = 0
  while (start < typed.length && start < expected.length && typed[start] === expected[start]) start += 1
  let endTyped = typed.length
  let endExpected = expected.length
  while (endTyped > start && endExpected > start && typed[endTyped - 1] === expected[endExpected - 1]) {
    endTyped -= 1
    endExpected -= 1
  }
  const split = (text: string, from: number, to: number): DiffPart[] =>
    [
      { text: text.slice(0, from), changed: false },
      { text: text.slice(from, to), changed: true },
      { text: text.slice(to), changed: false },
    ].filter((part) => part.text !== '')
  return { typed: split(typed, start, endTyped), expected: split(expected, start, endExpected) }
}

/**
 * Compares what was typed with the accepted answers: exact -> Good; a single typo (Damerau-
 * Levenshtein distance 1, only on words of more than 4 letters) -> Hard; anything else -> Again.
 */
export function checkAnswer(input: string, accepted: readonly string[]): CheckResult {
  const typed = normalizeAnswer(input)
  const candidates = accepted.map((answer) => ({ shown: answer, key: normalizeAnswer(answer) })).filter((answer) => answer.key)
  const fallback = candidates[0]?.shown ?? ''
  if (!typed) return { verdict: 'empty', suggestedGrade: null, expected: fallback }

  const exact = candidates.find((answer) => answer.key === typed)
  if (exact) return { verdict: 'exact', suggestedGrade: 3, expected: exact.shown }

  const close = candidates.find((answer) => answer.key.length >= TYPO_MIN_LENGTH && damerauLevenshtein(typed, answer.key) === 1)
  if (close) return { verdict: 'typo', suggestedGrade: 2, expected: close.shown, diff: diffParts(typed, normalizeAnswer(close.shown)) }

  return { verdict: 'wrong', suggestedGrade: 1, expected: fallback }
}

/**
 * Every answer that counts as right for a gap whose word is `answer`: the word itself, the other
 * British/American spellings and, for a verb form, every valid variant of it (learnt / learned).
 */
export function acceptedAnswers(entry: Pick<Entry, 'forms'>, answer: string): string[] {
  const key = normalizeAnswer(answer)
  const verb = entry.forms?.verb
  const sameForms = [verb?.pastSimple, verb?.pastParticiple].find((forms) => forms?.some((form) => normalizeAnswer(form) === key))
  const base = [answer, ...(sameForms ?? [])]
  const result = new Map<string, string>()
  for (const form of base) {
    result.set(normalizeAnswer(form), form)
    for (const variant of spellingVariants(normalizeAnswer(form))) if (!result.has(variant)) result.set(variant, variant)
  }
  return [...result.values()]
}
