import { describe, expect, it } from 'vitest'
import { findRelated, MAX_RELATED } from '../../../src/features/entry/related.ts'
import type { Entry } from '../../../src/shared/index.ts'
import { makeEntry } from '../../factories.ts'

const entry = (lemma: string, overrides: Partial<Entry> = {}) => makeEntry({ lemma, lemmaKey: lemma, ...overrides })
const ctx = (sourceId: string) => ({ id: `c-${sourceId}-${Math.random()}`, sentence: 'x', sourceId, addedAt: 1 })

describe('findRelated', () => {
  const decide = entry('decide', {
    family: [
      { word: 'decision', pos: 'noun', meaningEs: 'decisión', example: 'x' },
      { word: 'decisive', pos: 'adjective', meaningEs: 'decisivo', example: 'x' },
    ],
    topicIds: ['t-office'],
    contexts: [ctx('s-suits')],
  })

  it('finds entries of the same family, in either direction', () => {
    const decision = entry('decision')
    const indecisive = entry('indecisive', { family: [{ word: 'decide', pos: 'verb', meaningEs: 'decidir', example: 'x' }] })

    const related = findRelated(decide, [decision, indecisive, entry('unrelated')])

    expect(related.map((r) => [r.entry.lemma, r.reason])).toEqual([
      ['decision', 'family'],
      ['indecisive', 'family'],
    ])
  })

  it('finds entries that share a topic or a series', () => {
    const sameTopic = entry('deadline', { topicIds: ['t-office', 't-other'] })
    const sameSource = entry('bespoke', { contexts: [ctx('s-suits')] })

    const related = findRelated(decide, [sameSource, sameTopic])

    expect(related.map((r) => [r.entry.lemma, r.reason])).toEqual([
      ['deadline', 'topic'],
      ['bespoke', 'source'],
    ])
  })

  it('shows the strongest reason only once per entry, and orders by reason then recency', () => {
    const all = entry('decision', { topicIds: ['t-office'], contexts: [ctx('s-suits')], createdAt: 1 })
    const newerTopic = entry('meeting', { topicIds: ['t-office'], createdAt: 9 })
    const olderTopic = entry('memo', { topicIds: ['t-office'], createdAt: 2 })

    const related = findRelated(decide, [olderTopic, newerTopic, all])

    expect(related.map((r) => [r.entry.lemma, r.reason])).toEqual([
      ['decision', 'family'],
      ['meeting', 'topic'],
      ['memo', 'topic'],
    ])
  })

  it('leaves out the entry itself, archived and deleted entries', () => {
    const related = findRelated(decide, [
      decide,
      entry('decision', { status: 'archived' }),
      entry('decisive', { deletedAt: 5 }),
      entry('deadline', { topicIds: ['t-office'] }),
    ])

    expect(related.map((r) => r.entry.lemma)).toEqual(['deadline'])
  })

  it('returns at most 8 (the spec limit)', () => {
    const many = Array.from({ length: 12 }, (_, i) => entry(`w${i}`, { topicIds: ['t-office'], createdAt: i }))

    expect(MAX_RELATED).toBe(8)
    expect(findRelated(decide, many)).toHaveLength(8)
    expect(findRelated(decide, many, 3)).toHaveLength(3)
  })

  it('has nothing for an entry without family, topic or source', () => {
    expect(findRelated(entry('lonely'), [entry('other')])).toEqual([])
  })
})
