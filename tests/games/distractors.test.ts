import { describe, expect, it } from 'vitest'
import { formCategory, formFor, pickDistractors, posGroup } from '../../src/games/distractors.ts'
import { seededRng } from '../../src/games/rng.ts'
import { entryOf, verbOf } from './helpers.ts'

const go = verbOf('go', ['went'], ['gone'])
const verbs = [verbOf('take', ['took'], ['taken']), verbOf('eat', ['ate'], ['eaten']), verbOf('see', ['saw'], ['seen']), verbOf('walk', ['walked'], ['walked'])]
const nouns = [entryOf('table', 'noun'), entryOf('chair', 'noun'), entryOf('river', 'noun')]
const pool = [go, ...verbs, ...nouns]

describe('forms of a word', () => {
  it('tells which form a text is', () => {
    expect(formCategory(go, 'went')).toBe('pastSimple')
    expect(formCategory(go, 'gone')).toBe('pastParticiple')
    expect(formCategory(go, 'going')).toBe('presentParticiple')
    expect(formCategory(go, 'goes')).toBe('thirdPerson')
    expect(formCategory(go, 'GO')).toBe('lemma')
    expect(formCategory(go, 'something else')).toBe('lemma')
  })

  it('looks the other forms of a word up, or says it has none', () => {
    expect(formFor(go, 'pastSimple')).toBe('went')
    expect(formFor(go, 'lemma')).toBe('go')
    expect(formFor(nouns[0] as (typeof nouns)[number], 'pastSimple')).toBeUndefined()
    const learnt = verbOf('learn', ['learnt', 'learned'], ['learnt', 'learned'])
    expect(formFor(learnt, 'pastSimple')).toBe('learnt')
  })

  it('treats idioms and expressions as one kind of word', () => {
    expect(posGroup('idiom')).toBe(posGroup('expression'))
    expect(posGroup('noun')).not.toBe(posGroup('verb'))
  })
})

describe('pickDistractors', () => {
  const request = (overrides = {}) => ({
    target: go,
    pos: 'verb' as const,
    category: 'pastSimple' as const,
    accepted: ['went'],
    pool,
    count: 3,
    rng: seededRng(1),
    ...overrides,
  })

  it('gives the wrong form of the same word, and other verbs in the same form', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const options = pickDistractors(request({ rng: seededRng(seed) }))
      expect(options).toHaveLength(3)
      expect(options).toContain('go')
      // The others are past forms of other verbs, not their base forms or nouns.
      const others = options.filter((option) => option !== 'go')
      expect(others.every((option) => ['took', 'ate', 'saw', 'walked'].includes(option))).toBe(true)
    }
  })

  it('never offers the answer, its variants, duplicates or the word itself in another way', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const options = pickDistractors(request({ rng: seededRng(seed), accepted: ['went', 'WENT'] }))
      expect(options).not.toContain('went')
      expect(new Set(options.map((option) => option.toLowerCase())).size).toBe(options.length)
    }
  })

  it('leaves out synonyms, antonyms and words with the same meaning, which could also fit', () => {
    const synonym = verbOf('travel', ['travelled'], ['travelled'])
    const sameMeaning = verbOf('depart', ['departed'], ['departed'])
    const target = verbOf('leave', ['left'], ['left'], { synonyms: ['travel'] })
    const sense = sameMeaning.senses[0] as (typeof sameMeaning.senses)[number]
    const clash = { ...sameMeaning, senses: [{ ...sense, meaningEs: (target.senses[0] as typeof sense).meaningEs }] }
    for (let seed = 0; seed < 20; seed += 1) {
      const options = pickDistractors(request({ target, accepted: ['left'], pool: [target, synonym, clash, ...verbs], rng: seededRng(seed) }))
      expect(options).not.toContain('travelled')
      expect(options).not.toContain('departed')
    }
  })

  it('prefers words of the same topic when it has the choice', () => {
    const topical = verbOf('order', ['ordered'], ['ordered'], { topicIds: ['pub'] })
    const target = entryOf('drink', 'verb', { topicIds: ['pub'], forms: undefined })
    const others = Array.from({ length: 6 }, (_, i) => entryOf(`verb${i}`, 'verb', { topicIds: ['office'] }))
    for (let seed = 0; seed < 20; seed += 1) {
      const options = pickDistractors({ target, pos: 'verb', category: 'lemma', accepted: ['drink'], pool: [target, topical, ...others], count: 1, rng: seededRng(seed) })
      expect(options).toEqual(['order'])
    }
  })

  it('uses other word types, and then base forms, when the collection is small', () => {
    const tiny = pickDistractors(request({ pool: [go, nouns[0] as (typeof nouns)[number], nouns[1] as (typeof nouns)[number]] }))
    expect(tiny).toHaveLength(3)
    expect(tiny).toContain('go')
    expect(tiny.filter((option) => option !== 'go').sort()).toEqual(['chair', 'table'])
  })

  it('returns fewer options than asked for when there are not enough words', () => {
    expect(pickDistractors(request({ pool: [go, verbs[0] as (typeof verbs)[number]], count: 4 }))).toEqual(['go', 'took', 'take'])
    expect(pickDistractors(request({ pool: [go] }))).toEqual(['go'])
  })

  it('works in the base form too: another form of the same word is the trap', () => {
    const options = pickDistractors(request({ category: 'lemma', accepted: ['go'] }))
    expect(options).toHaveLength(3)
    expect(options).not.toContain('go')
    expect(['went', 'gone', 'going', 'goes']).toContain(options[0])
  })
})
