import { describe, expect, it } from 'vitest'
import { buildCardModel } from '../../src/srs/cardModel.ts'
import { buildCloze, buildExamplePool, pickExample, senseOfExample } from '../../src/srs/examples.ts'
import type { Entry, Sense } from '../../src/shared/index.ts'
import { makeEntry } from '../factories.ts'

const sense = (id: string, meaningEs: string, examples: Array<[string, string, string?]>, matchesContext = false): Sense => ({
  id,
  pos: 'verb',
  meaningEs,
  definitionEn: '',
  register: 'neutral',
  examples: examples.map(([en, es, target]) => ({ en, es, ...(target ? { target } : {}) })),
  matchesContext,
})

const go: Entry = makeEntry({
  id: 'go',
  lemma: 'go',
  lemmaKey: 'go',
  seenForm: 'went',
  senses: [
    sense('s1', 'ir', [['I go to work by bus.', 'Voy al trabajo en autobús.', 'go'], ['We went to Paris.', 'Fuimos a París.', 'went']]),
    sense('s2', 'irse', [['I must go now.', 'Tengo que irme.', 'go']], true),
    sense('s3', 'turno', [["It's your go.", 'Es tu turno.', 'go'], ['Have another go!', '¡Inténtalo otra vez!', 'go']]),
  ],
  forms: { verb: { base: 'go', thirdPerson: 'goes', pastSimple: ['went'], pastParticiple: ['gone'], presentParticiple: 'going', irregular: true } },
  contexts: [
    { id: 'c1', sentence: 'We went to the pub after work.', translationEs: 'Fuimos al pub.', surface: 'went', addedAt: 1 },
    { id: 'c2', sentence: 'She went off on one.', addedAt: 2 },
  ],
})

describe('buildExamplePool', () => {
  it("puts the user's own sentences first, then the examples of the senses taking turns", () => {
    const pool = buildExamplePool(go)
    expect(pool.map((item) => item.sentence)).toEqual([
      'We went to the pub after work.',
      'She went off on one.',
      'I go to work by bus.', // sense 1
      'I must go now.', // sense 2
      "It's your go.", // sense 3
      'We went to Paris.', // sense 1 again
      'Have another go!', // sense 3 again
    ])
    expect(pool.map((item) => item.origin)).toEqual(['context', 'context', 'example', 'example', 'example', 'example', 'example'])
  })

  it('links the user sentences to the sense of their context, and each example to its own sense', () => {
    const pool = buildExamplePool(go)
    expect(pool[0]?.senseId).toBe('s2') // the sense marked as the one of the context
    expect(pool.find((item) => item.sentence === "It's your go.")?.senseId).toBe('s3')
  })

  it('leaves out blanks and repeated sentences, and copes with a word without examples', () => {
    const entry = makeEntry({ senses: [sense('a', 'x', [['Hello there.', 'Hola.'], ['hello there.', 'Hola.'], ['  ', '']])], contexts: [] })
    expect(buildExamplePool(entry).map((item) => item.sentence)).toEqual(['Hello there.'])
    expect(buildExamplePool(makeEntry({ senses: [], contexts: [] }))).toEqual([])
  })
})

describe('pickExample (a different sentence every review)', () => {
  const pool = buildExamplePool(go)

  it('shows the user sentence the first time and goes round the pool without repeating until it is used up', () => {
    const picks = pool.map((_, seen) => pickExample(pool, seen)?.sentence)
    expect(picks[0]).toBe('We went to the pub after work.')
    expect(new Set(picks).size).toBe(pool.length)
    // then it starts again
    expect(pickExample(pool, pool.length)).toBe(pool[0])
    expect(pickExample(pool, pool.length + 2)).toBe(pool[2])
  })

  it('moves through different meanings in consecutive reviews', () => {
    const senses = [2, 3, 4].map((seen) => pickExample(pool, seen)?.senseId)
    expect(new Set(senses).size).toBe(3)
  })

  it('returns nothing for an empty pool and never fails with odd counts', () => {
    expect(pickExample([], 5)).toBeUndefined()
    expect(pickExample(pool, -1)).toBe(pool.at(-1))
  })

  it('finds the sense to highlight, falling back to the one of the context and then the first', () => {
    expect(senseOfExample(go, pool[3])?.id).toBe('s2')
    expect(senseOfExample(go, undefined)?.id).toBe('s2')
    expect(senseOfExample(makeEntry({ senses: [sense('only', 'x', [])] }), undefined)?.id).toBe('only')
  })
})

describe('buildCloze', () => {
  it('takes the word out of the sentence, keeping the form it is written in', () => {
    const item = buildExamplePool(go)[0]!
    const cloze = buildCloze(go, item)
    expect(cloze).toMatchObject({ before: 'We ', answer: 'went', after: ' to the pub after work.' })
    expect(cloze?.accepted).toEqual(['went'])
  })

  it('finds the word by its known forms when the sentence has no marked target', () => {
    const cloze = buildCloze(go, { key: 'x', sentence: 'They are going home.', translationEs: '', target: undefined, senseId: 's1', origin: 'example' })
    expect(cloze).toMatchObject({ before: 'They are ', answer: 'going', after: ' home.' })
  })

  it('takes out a whole phrasal verb', () => {
    const giveUp = makeEntry({ lemma: 'give up', lemmaKey: 'give up', seenForm: 'gave up', senses: [sense('g', 'rendirse', [])] })
    const cloze = buildCloze(giveUp, { key: 'x', sentence: 'He gave up smoking.', translationEs: '', target: 'gave up', senseId: 'g', origin: 'example' })
    expect(cloze).toMatchObject({ before: 'He ', answer: 'gave up', after: ' smoking.' })
  })

  it('is null when the word is not in the sentence', () => {
    expect(buildCloze(go, { key: 'x', sentence: 'Nothing here.', translationEs: '', target: undefined, senseId: 's1', origin: 'example' })).toBeNull()
  })

  it('accepts the other spelling and every verb variant', () => {
    const learn = makeEntry({
      lemma: 'learn',
      lemmaKey: 'learn',
      senses: [sense('l', 'aprender', [])],
      forms: { verb: { base: 'learn', thirdPerson: 'learns', pastSimple: ['learnt', 'learned'], pastParticiple: ['learnt', 'learned'], presentParticiple: 'learning', irregular: false } },
    })
    const cloze = buildCloze(learn, { key: 'x', sentence: 'She learnt it fast.', translationEs: '', target: 'learnt', senseId: 'l', origin: 'example' })
    expect(cloze?.accepted.sort()).toEqual(['learned', 'learnt'])
  })
})

describe('buildCardModel', () => {
  const card = (type: 'recognition' | 'production', seen: number) => ({ type, stats: { seen, correct: 0, wrong: 0, streak: 0 } })

  it('shows a different sentence at every review of a recognition card, with the sense it uses', () => {
    const models = [0, 1, 2, 3, 4, 5, 6].map((seen) => buildCardModel(card('recognition', seen), go, { showSentenceOnFront: true }))
    expect(new Set(models.map((m) => m.example?.sentence)).size).toBe(7)
    expect(models.every((m) => m.type === 'recognition' && m.showSentence)).toBe(true)
    expect(models.map((m) => (m.type === 'recognition' ? m.sense?.id : ''))).toEqual(['s2', 's2', 's1', 's2', 's3', 's1', 's3'])
  })

  it('keeps the sentence off the front when the setting is off or there is none, but still picks the sense', () => {
    const off = buildCardModel(card('recognition', 0), go, { showSentenceOnFront: false })
    expect(off).toMatchObject({ showSentence: false })
    expect(off.example?.sentence).toBe('We went to the pub after work.')
    const bare = buildCardModel(card('recognition', 0), makeEntry({ senses: [sense('s', 'x', [])], contexts: [] }), { showSentenceOnFront: true })
    expect(bare).toMatchObject({ showSentence: false, example: undefined })
  })

  it('builds a gap for a production card, on another sentence than its sibling, and goes round too', () => {
    const first = buildCardModel(card('production', 0), go, { showSentenceOnFront: true })
    expect(first.type === 'production' && first.cloze).toBeTruthy()
    if (first.type !== 'production' || !first.cloze) throw new Error('expected a gap')
    expect(first.example?.sentence).not.toBe('We went to the pub after work.') // the recognition card starts there
    const answers = new Set([0, 1, 2, 3, 4, 5, 6].map((seen) => {
      const model = buildCardModel(card('production', seen), go, { showSentenceOnFront: true })
      return model.type === 'production' ? model.example?.sentence : ''
    }))
    expect(answers.size).toBe(7)
  })

  it('asks for the base form when no sentence can be turned into a gap', () => {
    const colour = makeEntry({
      lemma: 'colour',
      lemmaKey: 'colour',
      senses: [sense('c', 'color', [['Pick a hue.', 'Elige un tono.']])],
      contexts: [],
    })
    const model = buildCardModel(card('production', 0), colour, { showSentenceOnFront: true })
    expect(model).toMatchObject({ type: 'production', cloze: null })
    expect(model.type === 'production' && model.accepted.sort()).toEqual(['color', 'colour'])
  })
})
