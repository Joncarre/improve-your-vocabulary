import { describe, expect, it } from 'vitest'
import { EnrichOutputSchema, EnrichPayloadSchema, normalizeEnrich } from '../../src/shared/index.ts'
import { makeEnrichOutput } from '../factories.ts'

const noTopics = { existingTopics: [] }

describe('EnrichPayloadSchema', () => {
  it('trims the word and defaults the optional parts', () => {
    expect(EnrichPayloadSchema.parse({ input: '  went  ' })).toEqual({ input: 'went', existingTopics: [], mode: 'full' })
  })

  it('rejects words, sentences and topic lists over the limits', () => {
    expect(EnrichPayloadSchema.safeParse({ input: 'x'.repeat(81) }).success).toBe(false)
    expect(EnrichPayloadSchema.safeParse({ input: 'go', context: 'x'.repeat(401) }).success).toBe(false)
    const topics = Array.from({ length: 51 }, (_, i) => ({ id: `t${i}`, nameEs: 'x' }))
    expect(EnrichPayloadSchema.safeParse({ input: 'go', existingTopics: topics }).success).toBe(false)
  })
})

describe('EnrichOutputSchema', () => {
  it('accepts a complete answer', () => {
    expect(EnrichOutputSchema.safeParse(makeEnrichOutput()).success).toBe(true)
  })

  it('requires every field (structured outputs have no optional ones)', () => {
    const { learnerNote: _omitted, ...incomplete } = makeEnrichOutput()
    expect(EnrichOutputSchema.safeParse(incomplete).success).toBe(false)
  })
})

describe('normalizeEnrich', () => {
  const sense = (meaningEs: string, matchesContext = false) => ({
    pos: 'verb' as const,
    meaningEs,
    definitionEn: `def ${meaningEs}`,
    register: 'neutral' as const,
    examples: [],
    matchesContext,
  })

  it('keeps at most 4 senses, 2 examples each, and the limits of every list', () => {
    const example = (n: number) => ({ en: `Example ${n}.`, es: `Ejemplo ${n}.`, target: 'x' })
    const output = makeEnrichOutput({
      senses: Array.from({ length: 6 }, (_, i) => ({ ...sense(`s${i}`), examples: [example(1), example(2), example(3)] })),
      family: Array.from({ length: 8 }, (_, i) => ({ word: `w${i}`, pos: 'noun' as const, meaningEs: 'm', example: 'e' })),
      synonyms: ['a', 'b', 'c', 'd', 'e'],
      antonyms: ['a', 'b', 'c', 'd', 'e'],
      collocations: ['a', 'b', 'c', 'd', 'e', 'f'],
    })
    const result = normalizeEnrich(output, noTopics)

    expect(result.senses).toHaveLength(4)
    expect(result.senses.every((s) => s.examples.length === 2)).toBe(true)
    expect(result.family).toHaveLength(6)
    expect(result.synonyms).toHaveLength(4)
    expect(result.antonyms).toHaveLength(4)
    expect(result.collocations).toHaveLength(5)
  })

  it('puts the sense of the sentence first and lets only one claim it', () => {
    const output = makeEnrichOutput({ senses: [sense('uno'), sense('dos', true), sense('tres', true)] })
    const result = normalizeEnrich(output, { ...noTopics, context: 'We went home.' })

    // A second sense the model also tied to the sentence stays right behind the first one.
    expect(result.senses.map((s) => s.meaningEs)).toEqual(['dos', 'tres', 'uno'])
    expect(result.senses.map((s) => s.matchesContext)).toEqual([true, false, false])
  })

  it('never marks a sense as the one in my sentence when there is no sentence', () => {
    const result = normalizeEnrich(makeEnrichOutput({ senses: [sense('uno', true)] }), noTopics)
    expect(result.senses[0]?.matchesContext).toBe(false)
  })

  it('drops empty senses, blank list items and duplicates', () => {
    const output = makeEnrichOutput({ senses: [sense(''), sense('ir')], synonyms: ['move', ' move ', '', 'travel'] })
    const result = normalizeEnrich({ ...output, senses: [{ ...sense(''), definitionEn: '' }, sense('ir')] }, noTopics)

    expect(result.senses.map((s) => s.meaningEs)).toEqual(['ir'])
    expect(result.synonyms).toEqual(['move', 'travel'])
  })

  it('keeps only offered topic ids, at most two', () => {
    const existingTopics = [
      { id: 't1', nameEs: 'En el pub' },
      { id: 't2', nameEs: 'Discusiones' },
      { id: 't3', nameEs: 'Oficina' },
    ]
    const result = normalizeEnrich(makeEnrichOutput({ topicIds: ['t3', 'invented', 't1', 't2'] }), { existingTopics })
    expect(result.topicIds).toEqual(['t3', 't1'])
  })

  it('drops a new topic without a name', () => {
    const result = normalizeEnrich(makeEnrichOutput({ newTopic: { nameEs: '  ', emoji: '🍺' } }), noTopics)
    expect(result.newTopic).toBeNull()
  })

  it('ignores an alternative unit that is just the lemma', () => {
    expect(normalizeEnrich(makeEnrichOutput({ alternativeUnit: 'Go' }), noTopics).alternativeUnit).toBe('')
    expect(normalizeEnrich(makeEnrichOutput({ alternativeUnit: 'go off on one' }), noTopics).alternativeUnit).toBe(
      'go off on one',
    )
  })
})
