import { describe, expect, it } from 'vitest'
import { acceptedAnswers, checkAnswer, damerauLevenshtein, diffParts, normalizeAnswer } from '../../src/srs/checker.ts'
import { spellingVariants } from '../../src/srs/variants.ts'
import type { Entry } from '../../src/shared/index.ts'

describe('normalizeAnswer', () => {
  it('ignores case, extra spaces, typographic apostrophes and final punctuation', () => {
    expect(normalizeAnswer('  Went.  ')).toBe('went')
    expect(normalizeAnswer('DON’T')).toBe("don't")
    expect(normalizeAnswer('give   up!')).toBe('give up')
    expect(normalizeAnswer('“Cheers”')).toBe('cheers')
    expect(normalizeAnswer('')).toBe('')
  })
})

describe('damerauLevenshtein', () => {
  it.each([
    ['went', 'went', 0],
    ['went', 'wnt', 1], // a missing letter
    ['went', 'wentt', 1], // an extra letter
    ['went', 'wext', 1], // a wrong letter
    ['went', 'wnet', 1], // two neighbours swapped
    ['went', 'wnte', 2],
    ['', 'abc', 3],
  ])('%s vs %s = %d', (a, b, distance) => expect(damerauLevenshtein(a, b)).toBe(distance))
})

describe('checkAnswer', () => {
  it('accepts an exact answer as Good, whatever the case or the spaces', () => {
    expect(checkAnswer('  WENT ', ['went'])).toMatchObject({ verdict: 'exact', suggestedGrade: 3, expected: 'went' })
    expect(checkAnswer("don’t", ["don't"]).verdict).toBe('exact')
  })

  it('suggests Hard for one slip on a word of more than four letters, and shows where', () => {
    const result = checkAnswer('decied', ['decide']) // swapped neighbours
    expect(result).toMatchObject({ verdict: 'typo', suggestedGrade: 2, expected: 'decide' })
    expect(result.diff?.typed.map((p) => p.text).join('')).toBe('decied')
    expect(result.diff?.expected.filter((p) => p.changed).map((p) => p.text)).toEqual(['de'])
    expect(checkAnswer('knackerd', ['knackered']).verdict).toBe('typo')
    expect(checkAnswer('knackeredd', ['knackered']).verdict).toBe('typo')
  })

  it('does not forgive a slip in a short word (four letters or fewer)', () => {
    expect(checkAnswer('wnt', ['went'])).toMatchObject({ verdict: 'wrong', suggestedGrade: 1 })
    expect(checkAnswer('lorr', ['lorry']).verdict).toBe('typo') // five letters is long enough
    expect(checkAnswer('gon', ['gone']).verdict).toBe('wrong')
  })

  it('marks anything else as wrong (Again), and an empty box as nothing typed', () => {
    expect(checkAnswer('goed', ['went'])).toMatchObject({ verdict: 'wrong', suggestedGrade: 1, expected: 'went' })
    expect(checkAnswer('decidd', ['decide']).verdict).toBe('typo')
    expect(checkAnswer('decide it', ['decide']).verdict).toBe('wrong')
    expect(checkAnswer('   ', ['went'])).toMatchObject({ verdict: 'empty', suggestedGrade: null })
  })

  it('compares with every accepted answer and reports the one it matched', () => {
    const accepted = ['learnt', 'learned']
    expect(checkAnswer('Learned', accepted)).toMatchObject({ verdict: 'exact', expected: 'learned' })
    expect(checkAnswer('lerned', accepted)).toMatchObject({ verdict: 'typo', expected: 'learned' })
  })
})

describe('diffParts', () => {
  it('keeps what is shared at both ends and marks the middle', () => {
    expect(diffParts('decied', 'decide')).toEqual({
      typed: [{ text: 'deci', changed: false }, { text: 'ed', changed: true }],
      expected: [{ text: 'deci', changed: false }, { text: 'de', changed: true }],
    })
    expect(diffParts('wnt', 'went').expected).toEqual([{ text: 'w', changed: false }, { text: 'e', changed: true }, { text: 'nt', changed: false }])
  })
})

describe('spellingVariants', () => {
  it('turns British spellings into American ones and the other way round, inflections included', () => {
    expect(spellingVariants('colour')).toEqual(['color'])
    expect(spellingVariants('coloured')).toEqual(['colored'])
    expect(spellingVariants('color')).toEqual(['colour'])
    expect(spellingVariants('organise')).toEqual(['organize'])
    expect(spellingVariants('travelled')).toEqual(['traveled'])
    expect(spellingVariants('centre')).toEqual(['center'])
    expect(spellingVariants('learnt')).toEqual(['learned'])
  })

  it('works word by word in an expression', () => {
    expect(spellingVariants('colour in')).toEqual(['color in'])
    expect(spellingVariants('go off on one')).toEqual([])
  })

  it('does not turn a word into a different real word', () => {
    expect(spellingVariants('tyre')).toEqual([])
    expect(spellingVariants('check')).toEqual([])
    expect(spellingVariants('hour')).toEqual([])
    expect(spellingVariants('four')).toEqual([])
  })
})

describe('acceptedAnswers', () => {
  const learn = {
    forms: {
      verb: {
        base: 'learn',
        thirdPerson: 'learns',
        pastSimple: ['learnt', 'learned'],
        pastParticiple: ['learnt', 'learned'],
        presentParticiple: 'learning',
        irregular: false,
      },
    },
  } satisfies Pick<Entry, 'forms'>

  it('accepts every valid variant of a verb form (learnt / learned)', () => {
    expect(acceptedAnswers(learn, 'learnt').sort()).toEqual(['learned', 'learnt'])
    expect(acceptedAnswers(learn, 'Learned').map((a) => a.toLowerCase()).sort()).toEqual(['learned', 'learnt'])
  })

  it('accepts the other spelling of a word without verb forms', () => {
    expect(acceptedAnswers({}, 'colour').sort()).toEqual(['color', 'colour'])
    expect(acceptedAnswers({}, 'went')).toEqual(['went'])
  })

  it('does not mix up forms: the infinitive does not make the past participle right', () => {
    const go = { forms: { verb: { base: 'go', thirdPerson: 'goes', pastSimple: ['went'], pastParticiple: ['gone', 'been'], presentParticiple: 'going', irregular: true } } }
    expect(acceptedAnswers(go, 'went')).toEqual(['went'])
    expect(acceptedAnswers(go, 'gone').sort()).toEqual(['been', 'gone'])
    expect(acceptedAnswers(go, 'go')).toEqual(['go'])
  })
})
