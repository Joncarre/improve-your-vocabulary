import type { Entry, PartOfSpeech } from '../shared/index.ts'
import { normalizeAnswer } from '../srs/checker.ts'
import { areNearSynonyms } from '../srs/queue.ts'
import { shuffle, type Rng } from './rng.ts'
import { mainSense } from './words.ts'

/** Which form of its word a text is: the base form or one of the inflections. */
export type FormCategory =
  | 'lemma'
  | 'thirdPerson'
  | 'pastSimple'
  | 'pastParticiple'
  | 'presentParticiple'
  | 'plural'
  | 'comparative'
  | 'superlative'

/** The form `surface` is, among the forms the entry knows. Anything unknown counts as the base form. */
export function formCategory(entry: Entry, surface: string): FormCategory {
  const key = normalizeAnswer(surface)
  const is = (form: string | undefined) => form !== undefined && normalizeAnswer(form) === key
  const isOne = (forms: readonly string[] | undefined) => forms?.some(is) ?? false
  const verb = entry.forms?.verb
  if (is(entry.lemma) || is(verb?.base)) return 'lemma'
  if (is(verb?.thirdPerson)) return 'thirdPerson'
  if (isOne(verb?.pastSimple)) return 'pastSimple'
  if (isOne(verb?.pastParticiple)) return 'pastParticiple'
  if (is(verb?.presentParticiple)) return 'presentParticiple'
  if (is(entry.forms?.noun?.plural)) return 'plural'
  if (is(entry.forms?.adjective?.comparative)) return 'comparative'
  if (is(entry.forms?.adjective?.superlative)) return 'superlative'
  return 'lemma'
}

/** The text of a word in a given form (British variant first), or undefined when it has no such form. */
export function formFor(entry: Entry, category: FormCategory): string | undefined {
  const verb = entry.forms?.verb
  switch (category) {
    case 'lemma':
      return entry.lemma
    case 'thirdPerson':
      return verb?.thirdPerson || undefined
    case 'pastSimple':
      return verb?.pastSimple[0] || undefined
    case 'pastParticiple':
      return verb?.pastParticiple[0] || undefined
    case 'presentParticiple':
      return verb?.presentParticiple || undefined
    case 'plural':
      return entry.forms?.noun?.plural || undefined
    case 'comparative':
      return entry.forms?.adjective?.comparative || undefined
    case 'superlative':
      return entry.forms?.adjective?.superlative || undefined
  }
}

const FORM_CATEGORIES: readonly FormCategory[] = ['lemma', 'thirdPerson', 'pastSimple', 'pastParticiple', 'presentParticiple', 'plural', 'comparative', 'superlative']

/** Idioms and expressions are one kind of word for the purpose of "same type". */
export function posGroup(pos: PartOfSpeech): string {
  return pos === 'idiom' || pos === 'expression' ? 'expression' : pos
}

export interface DistractorRequest {
  target: Entry
  /** The type of word that fits the gap. */
  pos: PartOfSpeech
  /** The form the gap asks for ("went" is a past simple). */
  category: FormCategory
  /** Everything that counts as right: no option may be one of these. */
  accepted: readonly string[]
  /** Every playable word: the options come from the whole collection, not only from the scope. */
  pool: readonly Entry[]
  count: number
  rng: Rng
}

/**
 * Wrong options for a gap (spec §8): in the same form as the answer ("went" gets "took", not "take"),
 * of the same word type and, when possible, of the same topic. One of them is usually a wrong form of
 * the answer's own word ("go"), so the right form is required. Words that could also be right
 * (synonyms, antonyms, same meaning) never appear. With a small collection the rules relax in this
 * order: other word types, then the base form of other words. It can return fewer than `count`.
 */
export function pickDistractors(request: DistractorRequest): string[] {
  const { target, pos, category, pool, count, rng } = request
  const taken = new Set(request.accepted.map(normalizeAnswer))
  const result: string[] = []
  const add = (text: string | undefined) => {
    const key = text ? normalizeAnswer(text) : ''
    if (!text || !key || taken.has(key) || result.length >= count) return
    taken.add(key)
    result.push(text)
  }

  // A wrong form of the same word: the base form when the gap needs an inflection, otherwise any other form.
  const ownForms = FORM_CATEGORIES.filter((other) => other !== category).flatMap((other) => formFor(target, other) ?? [])
  add(category === 'lemma' ? shuffle(ownForms, rng)[0] : target.lemma)

  const candidates = pool.filter((entry) => entry.id !== target.id && entry.lemmaKey !== target.lemmaKey && !areNearSynonyms(target, entry))
  const sameType = (entry: Entry) => {
    const other = mainSense(entry)?.pos
    return other !== undefined && posGroup(other) === posGroup(pos)
  }
  const sameTopic = (entry: Entry) => entry.topicIds.some((id) => target.topicIds.includes(id))
  const tiers = [
    candidates.filter((entry) => sameType(entry) && sameTopic(entry)),
    candidates.filter((entry) => sameType(entry) && !sameTopic(entry)),
    candidates.filter((entry) => !sameType(entry)),
  ]
  for (const tier of tiers) for (const entry of shuffle(tier, rng)) add(formFor(entry, category))
  // Too small a collection for the form: the base form of other words still makes a valid question.
  for (const entry of shuffle(candidates, rng)) add(entry.lemma)
  return result
}
