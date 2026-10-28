import type { Entry, PartOfSpeech } from '../shared/index.ts'
import { splitHighlight } from '../lib/highlight.ts'
import { acceptedAnswers, normalizeAnswer } from '../srs/checker.ts'
import { shuffle, type Rng } from './rng.ts'
import { MAX_ROUNDS, mainSense, planRounds, type GameWord, type PickOptions } from './words.ts'

/** `mixed`: slots when the family has several word types and sentences otherwise (and in turns when both are possible). */
export type FamilyMode = 'mixed' | 'sentences'

/** The word types that get a slot, in the order the slots are shown. */
export const SLOT_TYPES: readonly PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb']
/** A slots round needs at least this many slots to be a choice. */
export const MIN_SLOTS = 2

export interface FamilySlot {
  pos: PartOfSpeech
  answer: string
  meaningEs: string
}

/** "decide (v): put decision, decisive and decisively in their slots." */
export interface SlotsRound {
  kind: 'slots'
  entry: Entry
  /** The type of the given word, which has no slot. */
  ownPos: PartOfSpeech
  slots: FamilySlot[]
  /** The words to place, shuffled. */
  tiles: string[]
}

/** "She's very ____ (decide)": the member of the family that fits the sentence. */
export interface SentenceRound {
  kind: 'sentence'
  entry: Entry
  /** The type of word that fits the gap. */
  pos: PartOfSpeech
  before: string
  answer: string
  after: string
  accepted: string[]
  meaningEs: string
}

export type FamilyRound = SlotsRound | SentenceRound

const sameWord = (a: string, b: string) => normalizeAnswer(a) === normalizeAnswer(b)

/** The word types of the family that can fill a slot: one word for each type other than the given word's own. */
export function slotsOf(entry: Entry): FamilySlot[] {
  const own = mainSense(entry)?.pos
  const used = new Set<string>()
  return SLOT_TYPES.flatMap((pos) => {
    if (pos === own) return []
    const member = entry.family.find((candidate) => candidate.pos === pos && candidate.word.trim() && !sameWord(candidate.word, entry.lemma) && !used.has(normalizeAnswer(candidate.word)))
    if (!member) return []
    used.add(normalizeAnswer(member.word))
    return [{ pos, answer: member.word.trim(), meaningEs: member.meaningEs }]
  })
}

interface SentenceSource {
  pos: PartOfSpeech
  before: string
  answer: string
  after: string
  meaningEs: string
}

/** The family members whose example sentence contains the word, so it can be taken out. */
function sentencesOf(entry: Entry): SentenceSource[] {
  return entry.family.flatMap((member) => {
    const parts = splitHighlight(member.example, member.word)
    return parts ? [{ pos: member.pos, before: parts.before, answer: parts.match, after: parts.after, meaningEs: member.meaningEs }] : []
  })
}

/** What a word can offer: a round with slots, one with a sentence, or both. */
export function familyKinds(entry: Entry): { slots: boolean; sentence: boolean } {
  return { slots: slotsOf(entry).length >= MIN_SLOTS, sentence: sentencesOf(entry).length > 0 }
}

export function isFamilyPlayable(entry: Entry, mode: FamilyMode): boolean {
  const kinds = familyKinds(entry)
  return mode === 'sentences' ? kinds.sentence : kinds.slots || kinds.sentence
}

export interface FamilyContext {
  mode: FamilyMode
  /** Times this word has been played in this game: it alternates the kind of round and the sentence. */
  turn: number
  rng: Rng
}

/** The round for one word, or null when its family offers nothing for the mode. */
export function buildFamilyRound(entry: Entry, context: FamilyContext): FamilyRound | null {
  const kinds = familyKinds(entry)
  const useSlots = context.mode === 'mixed' && kinds.slots && (!kinds.sentence || context.turn % 2 === 0)

  if (useSlots) {
    const slots = slotsOf(entry)
    return {
      kind: 'slots',
      entry,
      ownPos: mainSense(entry)?.pos ?? 'noun',
      slots,
      tiles: shuffle(
        slots.map((slot) => slot.answer),
        context.rng,
      ),
    }
  }

  const sentences = sentencesOf(entry)
  // When slots and sentences take turns, each kind advances once every two plays.
  const index = context.mode === 'mixed' && kinds.slots ? Math.floor(context.turn / 2) : context.turn
  const chosen = sentences[index % sentences.length]
  if (!chosen) return null
  return { kind: 'sentence', entry, ...chosen, accepted: acceptedAnswers(entry, chosen.answer) }
}

export function isFamilyAnswer(round: SentenceRound, text: string): boolean {
  const key = normalizeAnswer(text)
  return key !== '' && round.accepted.some((accepted) => normalizeAnswer(accepted) === key)
}

export interface FamilyPlan {
  mode: FamilyMode
  turns: ReadonlyMap<string, number>
  pick: PickOptions
}

/** The rounds of a game: up to ten words that have a family. */
export function planFamily(words: readonly GameWord[], plan: FamilyPlan): FamilyRound[] {
  return planRounds(
    words.filter((word) => isFamilyPlayable(word.entry, plan.mode)),
    MAX_ROUNDS,
    plan.pick,
    (word) => buildFamilyRound(word.entry, { mode: plan.mode, turn: plan.turns.get(word.entry.id) ?? 0, rng: plan.pick.rng }),
  )
}
