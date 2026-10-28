import { describe, expect, it } from 'vitest'
import { buildDictationRound, judgeDictation, planDictation, SHORT_SENTENCE_WORDS } from '../../src/games/dictation.ts'
import { seededRng } from '../../src/games/rng.ts'
import { entryOf, pickOptions, senseOf, wordOf } from './helpers.ts'

const colour = entryOf('colour', 'noun', {
  senses: [
    senseOf({
      examples: [
        { en: 'My favourite colour is blue.', es: 'Mi color favorito es el azul.', target: 'colour' },
        { en: 'The colour of the walls was chosen by a committee that never agreed about anything at all.', es: 'Largo.', target: 'colour' },
        { en: 'What colour is it?', es: '¿De qué color es?', target: 'colour' },
      ],
    }),
  ],
})

describe('buildDictationRound', () => {
  it('asks for the word as it is in the dictionary and brings a short sentence that has it', () => {
    const round = buildDictationRound(colour, 0)
    expect(round?.answer).toBe('colour')
    expect(round?.sentence).toMatchObject({ text: 'My favourite colour is blue.', translationEs: 'Mi color favorito es el azul.', target: 'colour' })
  })

  it('goes round the short sentences as the word is played again, and never uses the long one', () => {
    const texts = [0, 1, 2, 3].map((turn) => buildDictationRound(colour, turn)?.sentence?.text)
    expect(texts[0]).toBe('My favourite colour is blue.')
    expect(texts[1]).toBe('What colour is it?')
    expect(texts[2]).toBe(texts[0])
    expect(texts.every((text) => (text?.split(' ').length ?? 0) <= SHORT_SENTENCE_WORDS)).toBe(true)
  })

  it('uses the shortest sentence when every one of them is long, and none when there is no sentence', () => {
    const long = entryOf('pint', 'noun', {
      senses: [
        senseOf({
          examples: [
            { en: 'We stayed at the pub for hours and had one more pint after another until closing time.', es: 'a', target: 'pint' },
            { en: 'After the long meeting we all went to the pub and each of us ordered a pint of bitter.', es: 'b', target: 'pint' },
          ],
        }),
      ],
    })
    expect(buildDictationRound(long, 0)?.sentence?.text).toContain('We stayed at the pub')
    expect(buildDictationRound(long, 1)?.sentence?.text).toContain('We stayed at the pub')
    const bare = entryOf('apple', 'noun', { senses: [senseOf({ examples: [] })], contexts: [] })
    expect(buildDictationRound(bare, 0)).toMatchObject({ answer: 'apple', sentence: null })
  })

  it('leaves out a sentence in which the word cannot be found', () => {
    const odd = entryOf('flat', 'noun', { senses: [senseOf({ examples: [{ en: 'It was very good.', es: 'Muy bueno.' }] })] })
    expect(buildDictationRound(odd, 0)?.sentence).toBeNull()
  })
})

describe('judgeDictation (British spelling, decision B12)', () => {
  const round = { answer: 'colour' }

  it('takes the word whatever the letter case and the spaces around it', () => {
    for (const typed of ['colour', 'Colour', '  COLOUR  ', 'colour.']) expect(judgeDictation(round, typed)).toMatchObject({ verdict: 'right', correct: true })
  })

  it('counts the American spelling as a mistake that says what to write', () => {
    expect(judgeDictation(round, 'color')).toMatchObject({ verdict: 'american', correct: false, expected: 'colour' })
    expect(judgeDictation({ answer: 'organise' }, 'organize')).toMatchObject({ verdict: 'american', correct: false })
    expect(judgeDictation({ answer: 'centre' }, 'center')).toMatchObject({ verdict: 'american', correct: false })
  })

  it('counts a single slip as a mistake too, showing where it is', () => {
    const result = judgeDictation({ answer: 'necessary' }, 'neccessary')
    expect(result).toMatchObject({ verdict: 'typo', correct: false })
    expect(result.diff?.typed.find((part) => part.changed)?.text).toBe('c')
    expect(judgeDictation({ answer: 'pint' }, 'pnt')).toMatchObject({ verdict: 'wrong' })
  })

  it('tells a wrong word and an empty answer apart', () => {
    expect(judgeDictation(round, 'flavour')).toMatchObject({ verdict: 'wrong', correct: false, expected: 'colour' })
    expect(judgeDictation(round, '   ')).toMatchObject({ verdict: 'empty', correct: false })
  })

  it('takes expressions of several words', () => {
    expect(judgeDictation({ answer: 'give up' }, 'Give  up')).toMatchObject({ correct: true })
    expect(judgeDictation({ answer: 'give up' }, 'giveup')).toMatchObject({ correct: false })
  })
})

describe('planDictation', () => {
  const words = Array.from({ length: 14 }, (_, i) => wordOf(entryOf(`word${i}`, 'noun')))
  const plan = { turns: new Map<string, number>(), pick: pickOptions() }

  it('makes ten rounds with ten different words', () => {
    const rounds = planDictation(words, plan)
    expect(rounds).toHaveLength(10)
    expect(new Set(rounds.map((round) => round.entry.id)).size).toBe(10)
  })

  it('makes fewer rounds with fewer words and moves the sentence on for a word played before', () => {
    expect(planDictation(words.slice(0, 5), plan)).toHaveLength(5)
    const again = planDictation([wordOf(colour)], { ...plan, turns: new Map([[colour.id, 1]]) })
    expect(again[0]?.sentence?.text).toBe('What colour is it?')
  })

  it('leans on the weakest words', () => {
    const crowd = Array.from({ length: 40 }, (_, i) => wordOf(entryOf(`crowd${i}`, 'noun')))
    const focus = new Set([crowd[3]?.entry.id ?? '', crowd[29]?.entry.id ?? ''])
    for (let seed = 0; seed < 10; seed += 1) {
      const rounds = planDictation(crowd, { ...plan, pick: pickOptions({ rng: seededRng(seed), focusIds: focus }) })
      expect([...focus].every((id) => rounds.some((round) => round.entry.id === id))).toBe(true)
    }
  })
})
