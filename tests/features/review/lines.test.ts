import { describe, expect, it } from 'vitest'
import { familyLine, formsLine, otherMeanings } from '../../../src/features/review/lines.ts'

describe('formsLine', () => {
  it('joins the verb forms without repeating any', () => {
    expect(
      formsLine({ forms: { verb: { base: 'learn', thirdPerson: 'learns', pastSimple: ['learnt', 'learned'], pastParticiple: ['learnt', 'learned'], presentParticiple: 'learning', irregular: false } } }),
    ).toBe('learn · learns · learnt · learned · learning')
  })

  it('adds the plural and the comparative forms, and is empty for a word without forms', () => {
    expect(formsLine({ forms: { noun: { plural: 'lorries', countability: 'countable' }, adjective: { comparative: 'better', superlative: 'best' } } })).toBe('lorries · better · best')
    expect(formsLine({})).toBe('')
    expect(formsLine({ forms: { noun: { countability: 'uncountable' } } })).toBe('')
  })
})

describe('familyLine and otherMeanings', () => {
  it('writes the family with short word types', () => {
    expect(
      familyLine({ family: [{ word: 'outgoing', pos: 'adjective', meaningEs: 'sociable', example: '' }, { word: 'going', pos: 'noun', meaningEs: 'ritmo', example: '' }] }),
    ).toBe('outgoing (adj.) · going (n.)')
    expect(familyLine({ family: [] })).toBe('')
  })

  it('lists the meanings other than the one on the card', () => {
    const sense = (id: string, meaningEs: string) => ({ id, pos: 'verb' as const, meaningEs, definitionEn: '', register: 'neutral' as const, examples: [], matchesContext: false })
    const senses = [sense('a', 'ir'), sense('b', 'irse'), sense('c', 'irse'), sense('d', 'turno')]
    expect(otherMeanings({ senses }, senses[0])).toEqual(['irse', 'turno'])
    expect(otherMeanings({ senses }, undefined)).toEqual(['ir', 'irse', 'turno'])
  })
})
