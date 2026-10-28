import type { Entry } from '../shared/index.ts'
import { normalizeAnswer } from '../srs/checker.ts'
import { shuffle, type Rng } from './rng.ts'
import { mainSense, weightedOrder, type GameWord, type PickOptions } from './words.ts'

/** English ↔ Spanish, word ↔ definition in English and, advanced, word ↔ IPA (spec §8). */
export type MatchVariant = 'es' | 'definition' | 'ipa'

/** 6 pairs make the 12 tiles of the 3 × 4 grid. */
export const MATCH_PAIRS = 6

export interface MatchTile {
  /** Unique in the board. */
  id: string
  /** The word both tiles of a pair belong to. */
  entryId: string
  text: string
  /** `word` is always in English; the other tile is the meaning, the definition or the pronunciation. */
  side: 'word' | 'other'
  kind: 'en' | 'es' | 'ipa'
}

export interface MatchBoard {
  entries: Entry[]
  /** The 12 tiles in the order they are laid out. */
  tiles: MatchTile[]
}

/** The text that goes with the word in each variant. */
export function otherSide(entry: Entry, variant: MatchVariant): string {
  const sense = mainSense(entry)
  switch (variant) {
    case 'es':
      return sense?.meaningEs.trim() ?? ''
    case 'definition':
      return sense?.definitionEn.trim() ?? ''
    case 'ipa':
      return entry.ipa.trim()
  }
}

const OTHER_KIND: Record<MatchVariant, MatchTile['kind']> = { es: 'es', definition: 'en', ipa: 'ipa' }

/**
 * The words that can be on a board together: each needs the text of the variant, and no two may
 * share a word or that text (two identical tiles would make a pair ambiguous). In the order given.
 */
export function distinctForMatch(words: readonly GameWord[], variant: MatchVariant): GameWord[] {
  const lemmas = new Set<string>()
  const texts = new Set<string>()
  return words.filter((word) => {
    const text = normalizeAnswer(otherSide(word.entry, variant))
    const lemma = normalizeAnswer(word.entry.lemma)
    if (!text || lemmas.has(lemma) || texts.has(text)) return false
    lemmas.add(lemma)
    texts.add(text)
    return true
  })
}

/** The board for six words: twelve tiles, shuffled. */
export function buildMatchBoard(words: readonly GameWord[], variant: MatchVariant, rng: Rng): MatchBoard {
  const entries = words.slice(0, MATCH_PAIRS).map((word) => word.entry)
  const tiles = entries.flatMap<MatchTile>((entry) => [
    { id: `${entry.id}:word`, entryId: entry.id, text: entry.lemma, side: 'word', kind: 'en' },
    { id: `${entry.id}:other`, entryId: entry.id, text: otherSide(entry, variant), side: 'other', kind: OTHER_KIND[variant] },
  ])
  return { entries, tiles: shuffle(tiles, rng) }
}

/** A board with six words drawn by weight, or null when there are not six words that can sit together. */
export function planMatch(words: readonly GameWord[], variant: MatchVariant, pick: PickOptions): MatchBoard | null {
  const distinct = distinctForMatch(weightedOrder(words, pick), variant)
  return distinct.length >= MATCH_PAIRS ? buildMatchBoard(distinct, variant, pick.rng) : null
}

/** Whether two tiles are the two halves of one pair. */
export function isPair(a: MatchTile, b: MatchTile): boolean {
  return a.id !== b.id && a.entryId === b.entryId
}
