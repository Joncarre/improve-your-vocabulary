import { seededRng } from '../../src/games/rng.ts'
import type { GameWord, PickOptions } from '../../src/games/words.ts'
import type { Entry, FamilyMember, Forms, PartOfSpeech, Sense } from '../../src/shared/index.ts'
import { makeCard, makeEntry } from '../factories.ts'

export const NOW = new Date(2026, 5, 10, 12, 0).getTime()
export const DAY = 86_400_000

let counter = 0

/** A playable word of the given type with one example sentence that contains it. */
export function entryOf(lemma: string, pos: PartOfSpeech, extra: Partial<Entry> = {}): Entry {
  counter += 1
  return makeEntry({
    id: `e${counter}-${lemma}`,
    lemma,
    lemmaKey: lemma.toLowerCase(),
    seenForm: undefined,
    ipa: `/${lemma}/`,
    senses: [
      {
        id: `s${counter}`,
        pos,
        meaningEs: `${lemma} (es)`,
        definitionEn: `the meaning of ${lemma}`,
        register: 'neutral',
        examples: [{ en: `They talked about the ${lemma} all evening.`, es: `Hablaron de eso.`, target: lemma }],
        matchesContext: true,
      },
    ],
    ...extra,
  })
}

/** A sense with nothing in it but what the test sets. */
export function senseOf(overrides: Partial<Sense> = {}): Sense {
  counter += 1
  return { id: `sense${counter}`, pos: 'noun', meaningEs: 'significado', definitionEn: 'a definition', register: 'neutral', examples: [], matchesContext: true, ...overrides }
}

type VerbForms = NonNullable<Forms['verb']>

/** A verb with its forms and sentences that use the base form and the past form. */
export function verbOf(base: string, pastSimple: string[], pastParticiple: string[], extra: Partial<Entry> = {}): Entry {
  const irregular = pastSimple[0] !== `${base}ed` && pastSimple[0] !== `${base}d`
  const thirdPerson = base.endsWith('o') ? `${base}es` : `${base}s`
  const verb: VerbForms = { base, thirdPerson, pastSimple, pastParticiple, presentParticiple: `${base}ing`, irregular }
  const entry = entryOf(base, 'verb', { forms: { verb }, ...extra })
  const sense = entry.senses[0] as Sense
  return {
    ...entry,
    senses: [
      {
        ...sense,
        meaningEs: `${base} (verbo)`,
        examples: [
          { en: `We ${pastSimple[0]} there yesterday.`, es: 'Ayer.', target: pastSimple[0] as string },
          { en: `I always ${base} early.`, es: 'Siempre.', target: base },
        ],
      },
    ],
  }
}

export function familyOf(lemma: string, pos: PartOfSpeech, family: FamilyMember[], extra: Partial<Entry> = {}): Entry {
  return entryOf(lemma, pos, { family, ...extra })
}

export function member(word: string, pos: PartOfSpeech, example = `This is a very ${word} thing.`): FamilyMember {
  return { word, pos, meaningEs: `${word} (es)`, example }
}

/** A word that has (or has not) been answered in a review. */
export function wordOf(entry: Entry, seen = true, cardExtra: Partial<ReturnType<typeof makeCard>> = {}): GameWord {
  const card = makeCard({ entryId: entry.id, stats: { seen: seen ? 3 : 0, correct: 0, wrong: 0, streak: 0 }, ...cardExtra })
  return { entry, cards: [card], seen }
}

export function pickOptions(overrides: Partial<PickOptions> = {}): PickOptions {
  return { now: NOW, desiredRetention: 0.9, failedAt: new Map(), rng: seededRng(1), ...overrides }
}
