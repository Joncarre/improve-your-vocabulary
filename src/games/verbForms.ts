import type { Entry } from '../shared/index.ts'
import { normalizeAnswer } from '../srs/checker.ts'
import { spellingVariants } from '../srs/variants.ts'
import { shuffle, type Rng } from './rng.ts'
import { MAX_ROUNDS, mainSense, planRounds, type GameWord, type PickOptions } from './words.ts'

export type VerbLevel = 'choose' | 'type'

/** Options per question: the right form and three wrong ones. */
export const VERB_OPTIONS = 4
/** Irregular verbs come up this many times more often than regular ones (spec §8: irregulars first). */
export const IRREGULAR_BOOST = 3

/** One of the two questions of a round. */
export interface VerbQuestion {
  /** The preferred (British) form, the one shown as the answer. */
  shown: string
  /** Everything that counts as right: every listed form and its other spelling (learnt / learned). */
  accepted: string[]
  /** The options in the order shown; empty when the answer is written. */
  options: string[]
}

export interface VerbRound {
  entry: Entry
  base: string
  meaningEs: string
  irregular: boolean
  pastSimple: VerbQuestion
  pastParticiple: VerbQuestion
}

/** A verb with both forms known. */
export function hasVerbForms(entry: Entry): boolean {
  const verb = entry.forms?.verb
  return Boolean(verb?.pastSimple[0]?.trim() && verb.pastParticiple[0]?.trim())
}

/** Every answer that counts: the listed forms and their other spelling, without "gotten" as a past simple. */
export function acceptedForms(forms: readonly string[], exclude: readonly string[] = []): string[] {
  const result = new Map<string, string>()
  for (const form of forms) {
    const key = normalizeAnswer(form)
    if (key) result.set(key, form)
    for (const variant of spellingVariants(key)) if (!result.has(variant)) result.set(variant, variant)
  }
  for (const word of exclude) result.delete(normalizeAnswer(word))
  return [...result.values()]
}

/** The form a child (or a learner) would invent: "goed", "taked", "studied". */
export function regularPast(base: string): string {
  const [verb = base, ...rest] = base.split(' ')
  const past = /[^aeiou]y$/.test(verb) ? `${verb.slice(0, -1)}ied` : verb.endsWith('e') ? `${verb}d` : `${verb}ed`
  return [past, ...rest].join(' ')
}

function question(
  forms: readonly string[],
  exclude: readonly string[],
  wrongFirst: readonly (string | undefined)[],
  wrongRandom: readonly (string | undefined)[],
  level: VerbLevel,
  rng: Rng,
): VerbQuestion {
  const shown = forms[0] ?? ''
  const accepted = acceptedForms(forms, exclude)
  if (level === 'type') return { shown, accepted, options: [] }

  const taken = new Set(accepted.map(normalizeAnswer))
  const wrong: string[] = []
  for (const text of [...wrongFirst, ...shuffle(wrongRandom, rng)]) {
    const key = text ? normalizeAnswer(text) : ''
    if (!text || !key || taken.has(key) || wrong.length >= VERB_OPTIONS - 1) continue
    taken.add(key)
    wrong.push(text)
  }
  return { shown, accepted, options: shuffle([shown, ...wrong], rng) }
}

/**
 * The two questions for a verb (past simple and past participle). Wrong options are forms of the
 * same verb: the other past form, the regular "-ed" a learner might invent, the base form and so on.
 */
export function buildVerbRound(entry: Entry, level: VerbLevel, rng: Rng): VerbRound | null {
  const verb = entry.forms?.verb
  if (!verb || !hasVerbForms(entry)) return null
  const sense = entry.senses.find((candidate) => candidate.pos === 'verb' || candidate.pos === 'phrasal_verb') ?? mainSense(entry)
  const base = verb.base.trim() || entry.lemma
  const invented = verb.irregular ? regularPast(base) : undefined
  const others = [base, verb.presentParticiple, verb.thirdPerson]

  return {
    entry,
    base,
    meaningEs: sense?.meaningEs ?? '',
    irregular: verb.irregular,
    pastSimple: question(verb.pastSimple, ['gotten'], [verb.pastParticiple[0], invented], others, level, rng),
    pastParticiple: question(verb.pastParticiple, [], [verb.pastSimple[0], invented], others, level, rng),
  }
}

export function isVerbAnswer(question: VerbQuestion, text: string): boolean {
  const key = normalizeAnswer(text)
  return key !== '' && question.accepted.some((accepted) => normalizeAnswer(accepted) === key)
}

export interface VerbPlan {
  level: VerbLevel
  pick: PickOptions
}

/** The rounds of a game: up to ten verbs, the irregular ones drawn more often. */
export function planVerbForms(words: readonly GameWord[], plan: VerbPlan): VerbRound[] {
  const boost = (word: GameWord) => (word.entry.forms?.verb?.irregular ? IRREGULAR_BOOST : 1) * (plan.pick.boost?.(word) ?? 1)
  return planRounds(
    words.filter((word) => hasVerbForms(word.entry)),
    MAX_ROUNDS,
    { ...plan.pick, boost },
    (word) => buildVerbRound(word.entry, plan.level, plan.pick.rng),
  )
}
