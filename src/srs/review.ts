import { db } from '../db/db.ts'
import { getActive, softDeleteRecord, writeRecord } from '../db/repo.ts'
import { newId } from '../lib/id.ts'
import type { Card, Entry, ReviewLog } from '../shared/index.ts'
import { gradeCard, State, type Grade } from './scheduler.ts'
import { studyDayEnd } from './studyDay.ts'

/** Recaídas de FSRS (an "Again" on a card that was in review) after which a word is "rebelde" (decision B5). */
export const LEECH_LAPSES = 6

/** What was changed by an answer, to put everything back when it is undone. */
export interface ReviewSnapshot {
  cardBefore: Card
  /** The sibling card, when answering unlocked it. */
  siblingBefore?: Card
  /** The entry, when answering marked it as "rebelde". */
  entryBefore?: Entry
  logId: string
}

export interface ReviewInput {
  cardId: string
  grade: Grade
  /** How long the answer took, in milliseconds. */
  ms: number
  /** The moment the scheduler works from: the one the buttons' intervals were calculated at, so the card gets what the button promised. */
  scheduleAt: number
  /** When the answer was given (defaults to the current time). */
  now?: number
  desiredRetention: number
  dayStartHour: number
}

function updatedStats(card: Card, correct: boolean, at: number): Card['stats'] {
  return {
    seen: card.stats.seen + 1,
    correct: card.stats.correct + (correct ? 1 : 0),
    wrong: card.stats.wrong + (correct ? 0 : 1),
    streak: correct ? card.stats.streak + 1 : 0,
    lastSeenAt: at,
  }
}

/**
 * Saves an answer to a regular review in one transaction: the card (FSRS state, due date and
 * statistics), the review log, the production card of the same word when this one leaves the
 * learning phase (it unlocks for the start of the next study day, decision B6) and the "rebelde"
 * mark after six lapses (B5). Everything is queued for sync.
 */
export async function reviewCard(input: ReviewInput): Promise<ReviewSnapshot> {
  const at = input.now ?? Date.now()
  return db.transaction('rw', [db.cards, db.logs, db.entries, db.outbox], async () => {
    const card = await getActive('cards', input.cardId)
    if (!card) throw new Error('La tarjeta ya no existe.')
    const entry = await getActive('entries', card.entryId)
    const correct = input.grade > 1
    const outcome = gradeCard(card.fsrs, input.grade, input.scheduleAt, input.desiredRetention)

    await writeRecord(
      'cards',
      { ...card, fsrs: outcome.card, due: outcome.card.due, stats: updatedStats(card, correct, at) },
      { now: at },
    )
    const log: ReviewLog = {
      id: newId(),
      cardId: card.id,
      entryId: card.entryId,
      at,
      origin: 'review',
      rating: input.grade,
      correct,
      ms: Math.max(0, Math.round(input.ms)),
      fsrsLog: outcome.log,
      updatedAt: at,
    }
    await writeRecord('logs', log, { now: at })

    const snapshot: ReviewSnapshot = { cardBefore: card, logId: log.id }

    if (card.type === 'recognition' && card.fsrs.state !== State.Review && outcome.card.state === State.Review) {
      const sibling = (await db.cards.where('entryId').equals(card.entryId).toArray()).find(
        (other) => other.type === 'production' && other.deletedAt === undefined && !other.unlocked,
      )
      if (sibling) {
        const available = studyDayEnd(at, input.dayStartHour)
        await writeRecord('cards', { ...sibling, unlocked: true, due: available, fsrs: { ...sibling.fsrs, due: available } }, { now: at })
        snapshot.siblingBefore = sibling
      }
    }

    if (entry && !entry.isLeech && outcome.card.lapses >= LEECH_LAPSES) {
      await writeRecord('entries', { ...entry, isLeech: true }, { now: at })
      snapshot.entryBefore = entry
    }
    return snapshot
  })
}

/**
 * An answer in an extra review ("Repasar esta serie", decision B8): it updates the statistics and
 * leaves a log with origin "extra", but never touches the FSRS state or the due date.
 */
export async function recordExtraReview(input: { cardId: string; correct: boolean; ms: number; now?: number }): Promise<ReviewSnapshot> {
  const at = input.now ?? Date.now()
  return db.transaction('rw', [db.cards, db.logs, db.outbox], async () => {
    const card = await getActive('cards', input.cardId)
    if (!card) throw new Error('La tarjeta ya no existe.')
    await writeRecord('cards', { ...card, stats: updatedStats(card, input.correct, at) }, { now: at })
    const log: ReviewLog = {
      id: newId(),
      cardId: card.id,
      entryId: card.entryId,
      at,
      origin: 'extra',
      correct: input.correct,
      ms: Math.max(0, Math.round(input.ms)),
      updatedAt: at,
    }
    await writeRecord('logs', log, { now: at })
    return { cardBefore: card, logId: log.id }
  })
}

/** Puts back everything one answer changed: the card, its statistics, the log, the sibling's unlock and the "rebelde" mark. */
export async function undoReview(snapshot: ReviewSnapshot, now = Date.now()): Promise<void> {
  await db.transaction('rw', [db.cards, db.logs, db.entries, db.outbox], async () => {
    await writeRecord('cards', snapshot.cardBefore, { now })
    if (snapshot.siblingBefore) await writeRecord('cards', snapshot.siblingBefore, { now })
    if (snapshot.entryBefore) await writeRecord('entries', snapshot.entryBefore, { now })
    await softDeleteRecord('logs', snapshot.logId, { now })
  })
}
