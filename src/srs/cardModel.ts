import type { Card, Entry, Sense } from '../shared/index.ts'
import { acceptedAnswers } from './checker.ts'
import { buildCloze, buildExamplePool, pickExample, senseOfExample, type Cloze, type ExampleItem } from './examples.ts'

export interface RecognitionModel {
  type: 'recognition'
  entry: Entry
  /** The sense of the sentence being shown (highlighted on the back). */
  sense: Sense | undefined
  /** The sentence of this review; with `showSentence` it is also on the front. */
  example: ExampleItem | undefined
  showSentence: boolean
}

export interface ProductionModel {
  type: 'production'
  entry: Entry
  sense: Sense | undefined
  example: ExampleItem | undefined
  /** The sentence with a gap; null when the word could not be found in any sentence (the card asks for the base form). */
  cloze: Cloze | null
  /** Everything that counts as right. */
  accepted: string[]
}

export type CardModel = RecognitionModel | ProductionModel

/**
 * What a card shows this time. The sentence depends on how many times the card has been answered,
 * so every review of a word shows a different one (and a different meaning when it has several).
 */
export function buildCardModel(card: Pick<Card, 'type' | 'stats'>, entry: Entry, options: { showSentenceOnFront: boolean }): CardModel {
  const pool = buildExamplePool(entry)

  if (card.type === 'recognition') {
    const example = pickExample(pool, card.stats.seen)
    return { type: 'recognition', entry, sense: senseOfExample(entry, example), example, showSentence: options.showSentenceOnFront && example !== undefined }
  }

  // The gap needs a sentence where the word can be found.
  const gaps = pool.flatMap((item) => {
    const cloze = buildCloze(entry, item)
    return cloze ? [{ item, cloze }] : []
  })
  // +1 so the written card starts on a different sentence than its sibling.
  const turn = card.stats.seen + 1
  const chosen = gaps.length > 0 ? gaps[turn % gaps.length] : undefined
  if (chosen) {
    return { type: 'production', entry, sense: senseOfExample(entry, chosen.item), example: chosen.item, cloze: chosen.cloze, accepted: chosen.cloze.accepted }
  }
  const example = pickExample(pool, turn)
  return { type: 'production', entry, sense: senseOfExample(entry, example), example, cloze: null, accepted: acceptedAnswers(entry, entry.lemma) }
}
