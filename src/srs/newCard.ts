import { createEmptyCard } from 'ts-fsrs'
import type { FsrsCard } from '../shared/index.ts'

/** A brand-new FSRS card, serialised the way it is stored (dates as millisecond timestamps). */
export function newFsrsCard(now: number): FsrsCard {
  const card = createEmptyCard(new Date(now))
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
  }
}
