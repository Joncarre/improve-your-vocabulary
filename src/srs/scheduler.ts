import { createEmptyCard, fsrs, generatorParameters, State, type Card as TsCard, type FSRS, type Grade as TsGrade } from 'ts-fsrs'
import type { FsrsCard } from '../shared/index.ts'

/** A rating the user can give: 1 Again, 2 Hard, 3 Good, 4 Easy. */
export type Grade = 1 | 2 | 3 | 4
export const GRADES: readonly Grade[] = [1, 2, 3, 4]

/**
 * Words never drop out of the review: however well they are known, they come back at least this
 * often (spec §7 "no se descarta"; decision of 2026-10-28).
 */
export const MAX_INTERVAL_DAYS = 180

/** Short learning steps (spec §7): 1 min then 10 min; a lapse is relearnt after 10 min. */
export const LEARNING_STEPS = ['1m', '10m'] as const
export const RELEARNING_STEPS = ['10m'] as const

const DAY_MS = 86_400_000
const instances = new Map<number, FSRS>()

/** The FSRS-6 scheduler of ts-fsrs for a desired retention (one instance per value). */
export function schedulerFor(desiredRetention: number): FSRS {
  let instance = instances.get(desiredRetention)
  if (!instance) {
    instance = fsrs(
      generatorParameters({
        request_retention: desiredRetention,
        maximum_interval: MAX_INTERVAL_DAYS,
        enable_fuzz: true,
        learning_steps: LEARNING_STEPS,
        relearning_steps: RELEARNING_STEPS,
      }),
    )
    instances.set(desiredRetention, instance)
  }
  return instance
}

/** The stored card (dates as milliseconds) as the library wants it. */
export function toTsCard(card: FsrsCard): TsCard {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as State,
    ...(card.last_review === undefined ? {} : { last_review: new Date(card.last_review) }),
  }
}

export function fromTsCard(card: TsCard): FsrsCard {
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
    ...(card.last_review ? { last_review: card.last_review.getTime() } : {}),
  }
}

/** ts-fsrs fuzzes the interval, which can push it a few days past the maximum: cut it back. */
function capInterval(card: TsCard, reviewedAt: number): TsCard {
  if (card.scheduled_days <= MAX_INTERVAL_DAYS) return card
  return { ...card, scheduled_days: MAX_INTERVAL_DAYS, due: new Date(reviewedAt + MAX_INTERVAL_DAYS * DAY_MS) }
}

export interface GradeOutcome {
  card: FsrsCard
  /** The library's review log, kept with the answer (dates as milliseconds). */
  log: Record<string, number>
}

/** Applies a rating to a card at `now`. */
export function gradeCard(card: FsrsCard, grade: Grade, now: number, desiredRetention: number): GradeOutcome {
  // Grade 1-4 are the numeric values of ts-fsrs' Rating.Again..Easy.
  const record = schedulerFor(desiredRetention).next(toTsCard(card), new Date(now), grade as TsGrade)
  const { log } = record
  return {
    card: fromTsCard(capInterval(record.card, now)),
    log: {
      rating: log.rating,
      state: log.state,
      due: log.due.getTime(),
      stability: log.stability,
      difficulty: log.difficulty,
      elapsed_days: log.elapsed_days,
      last_elapsed_days: log.last_elapsed_days,
      scheduled_days: log.scheduled_days,
      learning_steps: log.learning_steps,
      review: log.review.getTime(),
    },
  }
}

export interface GradePreview {
  due: number
  /** "10 min", "2 d"… */
  label: string
}

/** What each of the four buttons would do, for the interval shown under it. */
export function previewGrades(card: FsrsCard, now: number, desiredRetention: number): Record<Grade, GradePreview> {
  const result = {} as Record<Grade, GradePreview>
  for (const grade of GRADES) {
    const outcome = gradeCard(card, grade, now, desiredRetention)
    result[grade] = { due: outcome.card.due, label: formatInterval(outcome.card.due - now) }
  }
  return result
}

/** Probability of remembering the card at `now` (0-1); 0 for a card that has not started. */
export function retrievability(card: FsrsCard, now: number, desiredRetention: number): number {
  if (card.state === State.New) return 0
  return schedulerFor(desiredRetention).get_retrievability(toTsCard(card), new Date(now), false)
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** "10 min", "3 h", "2 d", "1,5 meses", "1 año": short, as on the buttons of Anki. */
export function formatInterval(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MINUTE))} min`
  if (ms < DAY_MS) return `${Math.round(ms / HOUR)} h`
  const days = Math.round(ms / DAY_MS)
  if (days < 30) return `${days} d`
  if (days < 365) {
    const months = days / 30
    return months < 10 && Math.abs(months - Math.round(months)) > 0.05
      ? `${months.toFixed(1).replace('.', ',')} meses`
      : `${Math.round(months)} ${Math.round(months) === 1 ? 'mes' : 'meses'}`
  }
  const years = days / 365
  return years < 1.95 ? '1 año' : `${years.toFixed(1).replace('.', ',')} años`
}

export { createEmptyCard, State }
