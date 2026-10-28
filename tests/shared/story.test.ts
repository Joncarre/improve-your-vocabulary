import { describe, expect, it } from 'vitest'
import {
  locateTargets,
  normalizeStory,
  StoryOutputSchema,
  StoryPayloadSchema,
  storyTargetsNeeded,
  type StoryOutput,
  type StoryTarget,
} from '../../src/shared/index.ts'

const TEXT = 'Tom gave up on the queue and went to the pub. The pint was cheap, so he had another pint.'

const target = (lemma: string, surfaceForm: string, start = 0, end = 0): StoryTarget => ({ lemma, surfaceForm, start, end })

describe('locateTargets (risk R12: the model counts characters badly)', () => {
  it('finds each word again whatever positions the model claimed', () => {
    const found = locateTargets(TEXT, [target('go', 'went', 999, 1003), target('give up', 'gave up', -5, 2), target('queue', 'queue', 0, 0)])
    expect(found.map((item) => TEXT.slice(item.start, item.end))).toEqual(['gave up', 'queue', 'went'])
    expect(found.map((item) => item.lemma)).toEqual(['give up', 'queue', 'go'])
  })

  it('returns the targets in reading order with the exact text, in the letter case of the story', () => {
    const found = locateTargets('Queue jumpers went home.', [target('go', 'WENT'), target('queue', 'queue')])
    expect(found).toEqual([
      { lemma: 'queue', surfaceForm: 'Queue', start: 0, end: 5 },
      { lemma: 'go', surfaceForm: 'went', start: 14, end: 18 },
    ])
  })

  it('takes the occurrence closest to the place the model claimed, when the word appears more than once', () => {
    const first = TEXT.indexOf('pint')
    const second = TEXT.lastIndexOf('pint')
    expect(locateTargets(TEXT, [target('pint', 'pint', second, second + 4)])[0]?.start).toBe(second)
    expect(locateTargets(TEXT, [target('pint', 'pint', first, first + 4)])[0]?.start).toBe(first)
    expect(locateTargets(TEXT, [target('pint', 'pint', Number.NaN, 0)])[0]?.start).toBe(first)
  })

  it('does not place two words on the same stretch of text', () => {
    const found = locateTargets('He went home.', [target('go', 'went'), target('leave', 'went')])
    expect(found).toHaveLength(1)
    expect(found[0]?.lemma).toBe('go')
  })

  it('puts a word that appears twice in the story where the model said, and the other where it did not', () => {
    const found = locateTargets('A pint is a pint.', [target('pint', 'pint', 0, 0), target('beer', 'pint', 10, 14)])
    expect(found.map((item) => [item.lemma, item.start])).toEqual([['pint', 2], ['beer', 12]])
  })

  it('drops what is not in the text, what is empty and a lemma that comes twice', () => {
    const found = locateTargets(TEXT, [target('fly', 'flew'), target('', 'queue'), target('queue', '  '), target('queue', 'queue'), target('Queue', 'queue')])
    expect(found.map((item) => item.lemma)).toEqual(['queue'])
  })

  it('only takes whole words: "go" is not inside "going" or "ago"', () => {
    expect(locateTargets('He is going ago.', [target('go', 'go')])).toEqual([])
    expect(locateTargets('Let it go.', [target('go', 'go')])[0]?.start).toBe(7)
  })

  it('takes expressions of several words, whatever the spaces between them', () => {
    expect(locateTargets('He gave   up smoking.', [target('give up', 'gave up')])[0]?.surfaceForm).toBe('gave   up')
  })

  it('does not break on punctuation in the word', () => {
    expect(locateTargets("It's o'clock (finally) now.", [target("o'clock", "o'clock"), target('finally', 'finally')]).map((item) => item.lemma)).toEqual(["o'clock", 'finally'])
    expect(locateTargets('Cost: $5.', [target('cost', 'cost')])).toHaveLength(1)
  })
})

describe('normalizeStory', () => {
  const words = [{ lemma: 'go' }, { lemma: 'queue' }, { lemma: 'give up' }]

  it('trims the texts and finds the words in the trimmed text', () => {
    const output: StoryOutput = { title: '  The Queue ', textEn: `\n  ${TEXT}  `, textEs: ' Un cuento. ', targets: [target('go', 'went', 9, 13)] }
    const story = normalizeStory(output, words)
    expect(story).toMatchObject({ title: 'The Queue', textEs: 'Un cuento.', textEn: TEXT })
    expect(story.textEn.slice(story.targets[0]?.start, story.targets[0]?.end)).toBe('went')
  })

  it('keeps only the words that were asked for, with the lemma of the request', () => {
    const story = normalizeStory(
      { title: 't', textEn: TEXT, textEs: 'e', targets: [target('GO', 'went'), target('pint', 'pint'), target('Give Up', 'gave up')] },
      words,
    )
    expect(story.targets.map((item) => item.lemma)).toEqual(['give up', 'go'])
  })
})

describe('storyTargetsNeeded', () => {
  it('asks for three words out of four', () => {
    expect([1, 3, 4, 6, 7, 8].map(storyTargetsNeeded)).toEqual([1, 3, 3, 5, 6, 6])
  })
})

describe('the schemas of the story', () => {
  it('takes 1 to 10 words with a type and defaults the level to B1', () => {
    const ok = StoryPayloadSchema.safeParse({ words: [{ lemma: 'go', pos: 'verb' }] })
    expect(ok.success && ok.data.level).toBe('B1')
    expect(StoryPayloadSchema.safeParse({ words: [] }).success).toBe(false)
    expect(StoryPayloadSchema.safeParse({ words: Array.from({ length: 11 }, () => ({ lemma: 'go', pos: 'verb' })) }).success).toBe(false)
    expect(StoryPayloadSchema.safeParse({ words: [{ lemma: 'go', pos: 'cat' }] }).success).toBe(false)
    expect(StoryPayloadSchema.safeParse({ words: [{ lemma: 'x'.repeat(81), pos: 'verb' }] }).success).toBe(false)
    expect(StoryPayloadSchema.safeParse({ words: [{ lemma: 'go', pos: 'verb' }], level: 'D9' }).success).toBe(false)
  })

  it('takes a story with the fields of the spec', () => {
    expect(StoryOutputSchema.safeParse({ title: 't', textEn: 'a', textEs: 'b', targets: [target('go', 'went', 1, 5)] }).success).toBe(true)
    expect(StoryOutputSchema.safeParse({ title: 't', textEn: 'a', textEs: 'b' }).success).toBe(false)
  })
})
