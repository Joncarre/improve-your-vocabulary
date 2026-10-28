import { describe, expect, it } from 'vitest'
import { buildFamilyRound, familyKinds, isFamilyAnswer, isFamilyPlayable, MIN_SLOTS, planFamily, slotsOf, type SentenceRound, type SlotsRound } from '../../src/games/family.ts'
import { seededRng } from '../../src/games/rng.ts'
import { entryOf, familyOf, member, pickOptions, wordOf } from './helpers.ts'

const decide = familyOf('decide', 'verb', [
  member('decision', 'noun', 'It was a difficult decision.'),
  member('decisive', 'adjective', "She's very decisive."),
  member('decisively', 'adverb', 'He acted decisively.'),
])

describe('slotsOf', () => {
  it('has a slot for each word type of the family except the type of the given word, in a fixed order', () => {
    expect(slotsOf(decide).map((slot) => [slot.pos, slot.answer])).toEqual([
      ['noun', 'decision'],
      ['adjective', 'decisive'],
      ['adverb', 'decisively'],
    ])
    const noun = familyOf('success', 'noun', [member('succeed', 'verb'), member('successful', 'adjective'), member('successor', 'noun')])
    expect(slotsOf(noun).map((slot) => slot.pos)).toEqual(['verb', 'adjective'])
  })

  it('takes one word per type, ignores the word itself and empty words', () => {
    const odd = familyOf('happy', 'adjective', [member('happiness', 'noun'), member('happiness', 'noun'), member('Happy', 'adjective'), member(' ', 'adverb'), member('happily', 'adverb')])
    expect(slotsOf(odd).map((slot) => slot.answer)).toEqual(['happiness', 'happily'])
  })

  it('does not use word types without a slot (phrasal verbs, expressions)', () => {
    const entry = familyOf('run', 'verb', [member('runner', 'noun'), member('run out', 'phrasal_verb')])
    expect(slotsOf(entry).map((slot) => slot.pos)).toEqual(['noun'])
  })
})

describe('what a word can offer', () => {
  it('slots need at least two types; sentences need the word inside its example', () => {
    expect(familyKinds(decide)).toEqual({ slots: true, sentence: true })
    const one = familyOf('beauty', 'noun', [member('beautiful', 'adjective', 'What a beautiful day!')])
    expect(familyKinds(one)).toEqual({ slots: false, sentence: true })
    const lost = familyOf('beauty', 'noun', [member('beautiful', 'adjective', 'What a lovely day!')])
    expect(familyKinds(lost)).toEqual({ slots: false, sentence: false })
    expect(familyKinds(entryOf('table', 'noun'))).toEqual({ slots: false, sentence: false })
    expect(MIN_SLOTS).toBe(2)
  })

  it('depends on the mode: "only sentences" needs a usable sentence', () => {
    const slotsOnly = familyOf('decide', 'verb', [member('decision', 'noun', 'No word here.'), member('decisive', 'adjective', 'Nor here.')])
    expect(isFamilyPlayable(slotsOnly, 'mixed')).toBe(true)
    expect(isFamilyPlayable(slotsOnly, 'sentences')).toBe(false)
  })
})

describe('buildFamilyRound', () => {
  it('shuffles the words to place and keeps the answer of each slot', () => {
    const round = buildFamilyRound(decide, { mode: 'mixed', turn: 0, rng: seededRng(4) }) as SlotsRound
    expect(round.kind).toBe('slots')
    expect(round.ownPos).toBe('verb')
    expect([...round.tiles].sort()).toEqual(['decision', 'decisive', 'decisively'])
  })

  it('alternates slots and sentences as the word is played, and moves on to another sentence', () => {
    const kinds = [0, 1, 2, 3].map((turn) => buildFamilyRound(decide, { mode: 'mixed', turn, rng: seededRng(1) })?.kind)
    expect(kinds).toEqual(['slots', 'sentence', 'slots', 'sentence'])
    const first = buildFamilyRound(decide, { mode: 'mixed', turn: 1, rng: seededRng(1) }) as SentenceRound
    const second = buildFamilyRound(decide, { mode: 'mixed', turn: 3, rng: seededRng(1) }) as SentenceRound
    expect(first.answer).not.toBe(second.answer)
  })

  it('only asks sentences in that mode, going round them', () => {
    const answers = [0, 1, 2, 3].map((turn) => (buildFamilyRound(decide, { mode: 'sentences', turn, rng: seededRng(1) }) as SentenceRound).answer)
    expect(answers).toEqual(['decision', 'decisive', 'decisively', 'decision'])
  })

  it('takes the word out of the sentence in the form written there', () => {
    const round = buildFamilyRound(decide, { mode: 'sentences', turn: 1, rng: seededRng(1) }) as SentenceRound
    expect(round).toMatchObject({ pos: 'adjective', before: "She's very ", answer: 'decisive', after: '.', meaningEs: 'decisive (es)' })
    expect(isFamilyAnswer(round, 'Decisive')).toBe(true)
    expect(isFamilyAnswer(round, 'decision')).toBe(false)
    expect(isFamilyAnswer(round, '')).toBe(false)
  })

  it('uses a sentence when the family has a single type, and nothing when it has no usable example', () => {
    const one = familyOf('beauty', 'noun', [member('beautiful', 'adjective', 'What a beautiful day!')])
    expect(buildFamilyRound(one, { mode: 'mixed', turn: 0, rng: seededRng(1) })?.kind).toBe('sentence')
    expect(buildFamilyRound(entryOf('table', 'noun'), { mode: 'mixed', turn: 0, rng: seededRng(1) })).toBeNull()
  })
})

describe('planFamily', () => {
  const entries = Array.from({ length: 6 }, (_, i) => familyOf(`root${i}`, 'verb', [member(`noun${i}`, 'noun', `A ${`noun${i}`} here.`), member(`adj${i}`, 'adjective', `An ${`adj${i}`} thing.`)]))

  it('makes a round for each word with a family, at most ten, and skips the rest', () => {
    const words = [...entries.map((entry) => wordOf(entry)), wordOf(entryOf('table', 'noun'))]
    const rounds = planFamily(words, { mode: 'mixed', turns: new Map(), pick: pickOptions() })
    expect(rounds).toHaveLength(6)
    expect(new Set(rounds.map((round) => round.entry.id)).size).toBe(6)
  })

  it('follows the turn of each word', () => {
    const words = entries.map((entry) => wordOf(entry))
    const first = planFamily(words, { mode: 'mixed', turns: new Map(), pick: pickOptions() })
    const second = planFamily(words, { mode: 'mixed', turns: new Map(entries.map((entry) => [entry.id, 1])), pick: pickOptions() })
    expect(first.every((round) => round.kind === 'slots')).toBe(true)
    expect(second.every((round) => round.kind === 'sentence')).toBe(true)
  })
})
