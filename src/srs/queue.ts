import { normalizeLemmaKey } from '../lib/lemmaKey.ts'
import type { Card, Entry } from '../shared/index.ts'
import { retrievability } from './scheduler.ts'
import { isActiveCard } from './state.ts'
import { studyDayEnd } from './studyDay.ts'

/** Learning cards due within this many minutes are offered early, so a session never stalls waiting for a 1-minute step. */
export const LEARN_AHEAD_MINUTES = 15
/** One new card after this many reviews (spec §7). */
export const REVIEWS_PER_NEW = 4
/** More reviews due than this is a backlog: urgent ones first and no new cards... */
export const BACKLOG_START = 150
/** ...until the pile is down to this many. */
export const BACKLOG_END = 50

export type QueueKind = 'learning' | 'review' | 'new'

export interface QueueItem {
  card: Card
  entry: Entry
  kind: QueueKind
}

export interface QueueInput {
  entries: readonly Entry[]
  cards: readonly Card[]
  now: number
  dayStartHour: number
  newPerDay: number
  productionEnabled: boolean
  desiredRetention: number
  /** Whether the backlog mode was on at the last check (it has two thresholds, so it needs memory). */
  backlogMode: boolean
  /** New cards already started today. */
  newStartedToday: number
  /** The words whose first card was started today, to keep near-synonyms apart. */
  newTodayEntryIds: ReadonlySet<string>
  /** Cards already answered today, by word: their sibling does not come up again today. */
  answeredToday: ReadonlyMap<string, ReadonlySet<string>>
}

export interface QueueResult {
  /** In the order to be shown: due learning, then reviews with a new card every four, then learning that is due soon. */
  items: QueueItem[]
  counts: {
    /** Learning cards in the queue. */
    learning: number
    /** Reviews due before the study day ends. */
    review: number
    /** New cards that will be introduced. */
    new: number
  }
  /** Backlog mode after this check: the caller keeps it for the next one. */
  backlogMode: boolean
  /** New cards were held back because of the backlog. */
  newBlocked: boolean
}

/** Backlog mode has two thresholds: it starts above 150 reviews and only ends below 50. */
export function nextBacklogMode(previous: boolean, reviewsDue: number): boolean {
  return previous ? reviewsDue >= BACKLOG_END : reviewsDue > BACKLOG_START
}

const meaningKey = (entry: Entry) => normalizeLemmaKey(entry.senses[0]?.meaningEs ?? '')

/**
 * Two words too alike to learn on the same day (spec §7, decision B7): one is a synonym or antonym
 * of the other, or their first meaning in Spanish is the same.
 */
export function areNearSynonyms(a: Entry, b: Entry): boolean {
  if (a.id === b.id) return false
  const related = (from: Entry, to: Entry) =>
    [...from.synonyms, ...from.antonyms].some((word) => normalizeLemmaKey(word) === to.lemmaKey)
  if (related(a, b) || related(b, a)) return true
  const key = meaningKey(a)
  return key !== '' && key === meaningKey(b)
}

/**
 * The cards to study now. Pure: everything it needs comes in `input`.
 *
 * - Learning cards come first when they are due; reviews follow, the ones closest to being
 *   forgotten first, with one new card after every four; learning cards due soon close the list.
 * - New cards are limited per day, and with a backlog there are none.
 * - A word's two cards never come up the same day, and near-synonyms are not introduced together.
 */
export function buildQueue(input: QueueInput): QueueResult {
  const { now, dayStartHour, desiredRetention } = input
  const dayEnd = studyDayEnd(now, dayStartHour)
  const entryById = new Map(input.entries.filter((entry) => entry.deletedAt === undefined && entry.status === 'active' && entry.senses.length > 0).map((entry) => [entry.id, entry]))

  const eligible = input.cards.filter(
    (card) => isActiveCard(card) && entryById.has(card.entryId) && (input.productionEnabled || card.type === 'recognition'),
  )
  // The sibling of a card answered today waits for tomorrow.
  const available = eligible.filter((card) => {
    const answered = input.answeredToday.get(card.entryId)
    return !answered || [...answered].every((id) => id === card.id)
  })

  const learnAhead = now + LEARN_AHEAD_MINUTES * 60_000
  const learningDue = available.filter((card) => (card.fsrs.state === 1 || card.fsrs.state === 3) && card.due <= now).sort((a, b) => a.due - b.due)
  const learningSoon = available.filter((card) => (card.fsrs.state === 1 || card.fsrs.state === 3) && card.due > now && card.due <= learnAhead).sort((a, b) => a.due - b.due)
  const reviews = available
    .filter((card) => card.fsrs.state === 2 && card.due <= dayEnd)
    .map((card) => ({ card, recall: retrievability(card.fsrs, now, desiredRetention) }))
    .sort((a, b) => a.recall - b.recall || a.card.due - b.card.due)
    .map(({ card }) => card)
  const reviewsDue = available.filter((card) => card.fsrs.state === 2 && card.due <= now).length

  const backlogMode = nextBacklogMode(input.backlogMode, reviewsDue)
  const newCandidates = available
    .filter((card) => card.fsrs.state === 0 && card.due <= now)
    .sort((a, b) => (entryById.get(a.entryId)?.createdAt ?? 0) - (entryById.get(b.entryId)?.createdAt ?? 0) || (a.type === b.type ? 0 : a.type === 'recognition' ? -1 : 1))

  const room = Math.max(0, input.newPerDay - input.newStartedToday)
  const news: Card[] = []
  if (!backlogMode) {
    const introduced = [...input.newTodayEntryIds].flatMap((id) => entryById.get(id) ?? [])
    for (const card of newCandidates) {
      if (news.length >= room) break
      const entry = entryById.get(card.entryId)
      if (!entry) continue
      const clash = [...introduced, ...news.flatMap((chosen) => entryById.get(chosen.entryId) ?? [])].some((other) => areNearSynonyms(entry, other))
      if (!clash) news.push(card)
    }
  }

  // Reviews with a new card after every four; a word never has two cards in the same list.
  const mixed: Array<{ card: Card; kind: QueueKind }> = []
  let newIndex = 0
  reviews.forEach((card, index) => {
    mixed.push({ card, kind: 'review' })
    const next = news[newIndex]
    if ((index + 1) % REVIEWS_PER_NEW === 0 && next) {
      mixed.push({ card: next, kind: 'new' })
      newIndex += 1
    }
  })
  for (const card of news.slice(newIndex)) mixed.push({ card, kind: 'new' })

  const ordered: Array<{ card: Card; kind: QueueKind }> = [
    ...learningDue.map((card) => ({ card, kind: 'learning' as const })),
    ...mixed,
    ...learningSoon.map((card) => ({ card, kind: 'learning' as const })),
  ]
  const taken = new Set<string>()
  const items: QueueItem[] = []
  for (const { card, kind } of ordered) {
    const entry = entryById.get(card.entryId)
    if (!entry || taken.has(card.entryId)) continue
    taken.add(card.entryId)
    items.push({ card, entry, kind })
  }

  return {
    items,
    counts: {
      learning: items.filter((item) => item.kind === 'learning').length,
      review: items.filter((item) => item.kind === 'review').length,
      new: items.filter((item) => item.kind === 'new').length,
    },
    backlogMode,
    newBlocked: backlogMode && newCandidates.length > 0 && room > 0,
  }
}

/**
 * The queue of an extra review ("Repasar esta serie"): the recognition card of every active word
 * of the list, the ones answered wrong most often first. It does not touch the FSRS calendar.
 */
export function buildExtraQueue(entries: readonly Entry[], cards: readonly Card[]): QueueItem[] {
  const entryById = new Map(entries.filter((entry) => entry.deletedAt === undefined && entry.status === 'active' && entry.senses.length > 0).map((entry) => [entry.id, entry]))
  return cards
    .filter((card) => card.deletedAt === undefined && card.type === 'recognition' && entryById.has(card.entryId))
    .sort((a, b) => b.stats.wrong - a.stats.wrong || (entryById.get(a.entryId)?.createdAt ?? 0) - (entryById.get(b.entryId)?.createdAt ?? 0))
    .flatMap((card) => {
      const entry = entryById.get(card.entryId)
      return entry ? [{ card, entry, kind: 'review' as const }] : []
    })
}
