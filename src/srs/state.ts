import type { Card } from '../shared/index.ts'

/** Learning state of a word (spec §7), from least to most learnt. */
export type WordState = 'new' | 'learning' | 'review' | 'consolidated' | 'mastered'

export const WORD_STATES: readonly WordState[] = ['new', 'learning', 'review', 'consolidated', 'mastered']

export const WORD_STATE_LABEL_ES: Record<WordState, string> = {
  new: 'Nueva',
  learning: 'Aprendiendo',
  review: 'En repaso',
  consolidated: 'Consolidada',
  mastered: 'Dominada',
}

const CONSOLIDATED_STABILITY_DAYS = 21
const MASTERED_STABILITY_DAYS = 60
const MASTERED_STREAK = 5

/** FSRS `State`: 0 New, 1 Learning, 2 Review, 3 Relearning. */
export function cardState(card: Pick<Card, 'fsrs' | 'stats'>): WordState {
  const { state, stability } = card.fsrs
  if (state === 0) return 'new'
  if (state === 1 || state === 3) return 'learning'
  if (stability >= MASTERED_STABILITY_DAYS && card.stats.streak >= MASTERED_STREAK) return 'mastered'
  if (stability >= CONSOLIDATED_STABILITY_DAYS) return 'consolidated'
  return 'review'
}

/** A card that takes part in reviews: not deleted, unlocked and not suspended. */
export function isActiveCard(card: Pick<Card, 'deletedAt' | 'unlocked' | 'suspended'>): boolean {
  return card.deletedAt === undefined && card.unlocked && !card.suspended
}

/** The state of an entry is the one of its weakest active card. */
export function entryState(cards: readonly Card[]): WordState {
  const active = cards.filter(isActiveCard)
  if (active.length === 0) return 'new'
  const rank = (state: WordState) => WORD_STATES.indexOf(state)
  return active.map(cardState).reduce((weakest, state) => (rank(state) < rank(weakest) ? state : weakest))
}
