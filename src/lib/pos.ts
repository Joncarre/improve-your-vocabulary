import type { PartOfSpeech } from '../shared/index.ts'

export const POS_LABEL_ES: Record<PartOfSpeech, string> = {
  noun: 'sustantivo',
  verb: 'verbo',
  adjective: 'adjetivo',
  adverb: 'adverbio',
  preposition: 'preposición',
  conjunction: 'conjunción',
  pronoun: 'pronombre',
  determiner: 'determinante',
  interjection: 'interjección',
  phrasal_verb: 'phrasal verb',
  idiom: 'expresión',
  expression: 'expresión',
}

export const POS_OPTIONS = Object.keys(POS_LABEL_ES) as PartOfSpeech[]

/** Chip colour of a part of speech (spec §12). */
export function posTone(pos: PartOfSpeech): 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrasal' | 'idiom' | 'other' {
  switch (pos) {
    case 'noun':
    case 'verb':
    case 'adjective':
    case 'adverb':
      return pos
    case 'phrasal_verb':
      return 'phrasal'
    case 'idiom':
    case 'expression':
      return 'idiom'
    default:
      return 'other'
  }
}
