import { describe, expect, it } from 'vitest'
import { seededRng } from '../../src/games/rng.ts'
import {
  buildBank,
  findReusableStory,
  isGapRight,
  STORY_MAX_WORDS,
  STORY_MIN_WORDS,
  storyGaps,
  storyLevel,
  storyRequest,
  storySegments,
  weakestWords,
} from '../../src/games/story.ts'
import type { Story } from '../../src/shared/index.ts'
import { DAY, entryOf, NOW, pickOptions, verbOf, wordOf } from './helpers.ts'

const TEXT = 'Tom gave up on the queue and went to the pub. He ordered a pint.'

const entries = {
  giveUp: entryOf('give up', 'phrasal_verb'),
  queue: entryOf('queue', 'noun'),
  go: verbOf('go', ['went'], ['gone']),
  pint: entryOf('pint', 'noun'),
}

const story = (overrides: Partial<Story> = {}): Story => ({
  id: 's1',
  title: 'A Pint',
  textEn: TEXT,
  textEs: 'Un cuento.',
  targets: [
    { lemma: 'give up', surfaceForm: 'gave up', start: 4, end: 11 },
    { lemma: 'queue', surfaceForm: 'queue', start: 19, end: 24 },
    { lemma: 'go', surfaceForm: 'went', start: 29, end: 33 },
    { lemma: 'pint', surfaceForm: 'pint', start: 59, end: 63 },
  ],
  entryIds: Object.values(entries).map((entry) => entry.id),
  level: 'B1',
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
})

describe('weakestWords', () => {
  const crowd = Array.from({ length: 20 }, (_, i) => wordOf(entryOf(`crowd${i}`, 'noun')))

  it('takes the eight weakest: the ones failed lately come before the others', () => {
    const failed = [crowd[3], crowd[11], crowd[17]].map((word) => word?.entry.id ?? '')
    for (let seed = 0; seed < 20; seed += 1) {
      const picked = weakestWords(crowd, pickOptions({ rng: seededRng(seed), failedAt: new Map(failed.map((id) => [id, NOW - DAY])) }))
      expect(picked).toHaveLength(STORY_MAX_WORDS)
      expect(failed.every((id) => picked.some((word) => word.entry.id === id))).toBe(true)
    }
  })

  it('puts the words failed in the review first, whatever else is weak', () => {
    const focus = new Set([crowd[0]?.entry.id ?? '', crowd[19]?.entry.id ?? ''])
    const leeches = crowd.map((word, i) => (i >= 10 ? { ...word, entry: { ...word.entry, isLeech: true } } : word))
    const picked = weakestWords(leeches, pickOptions({ focusIds: focus }))
    expect(picked.slice(0, 2).map((word) => word.entry.id).sort()).toEqual([...focus].sort())
  })

  it('takes turns among words that are about equally weak', () => {
    const firsts = new Set(Array.from({ length: 30 }, (_, seed) => weakestWords(crowd, pickOptions({ rng: seededRng(seed) }))[0]?.entry.id))
    expect(firsts.size).toBeGreaterThan(3)
  })

  it('takes all the words when there are only a few', () => {
    expect(weakestWords(crowd.slice(0, 6), pickOptions())).toHaveLength(STORY_MIN_WORDS)
  })
})

describe('storyLevel and storyRequest', () => {
  it('writes at the level in the middle of the words, B1 when none of them has one', () => {
    const at = (...levels: (string | undefined)[]) => levels.map((cefr) => entryOf('w', 'noun', cefr ? { cefr: cefr as never } : {}))
    expect(storyLevel(at('A2', 'B1', 'B2'))).toBe('B1')
    expect(storyLevel(at('C1', 'C1', 'B2', 'B1', 'C2'))).toBe('C1')
    expect(storyLevel(at(undefined, undefined))).toBe('B1')
    expect(storyLevel([])).toBe('B1')
  })

  it('asks for each word with its type and the level', () => {
    expect(storyRequest([entries.queue, entries.go, entries.giveUp])).toEqual({
      words: [
        { lemma: 'queue', pos: 'noun' },
        { lemma: 'go', pos: 'verb' },
        { lemma: 'give up', pos: 'phrasal_verb' },
      ],
      level: 'B1',
    })
  })
})

describe('findReusableStory', () => {
  const everyone = new Set(Object.values(entries).map((entry) => entry.id))
  const six = Array.from({ length: 6 }, (_, i) => `e${i}`)
  const sixIds = new Set(six)

  it('uses the last story that was not played, and nothing else', () => {
    const older = story({ id: 'old', createdAt: NOW - 2 * DAY, entryIds: six })
    const newer = story({ id: 'new', createdAt: NOW - DAY, entryIds: six })
    const played = story({ id: 'played', createdAt: NOW, entryIds: six, playedAt: NOW })
    const deleted = story({ id: 'gone', createdAt: NOW, entryIds: six, deletedAt: NOW })
    expect(findReusableStory([older, played, newer, deleted], sixIds, sixIds)?.id).toBe('new')
    expect(findReusableStory([played, deleted], sixIds, sixIds)).toBeUndefined()
    expect(findReusableStory([], sixIds, sixIds)).toBeUndefined()
  })

  it('needs six of its words to be still there, and most of them in the scope being played', () => {
    const base = story({ entryIds: six })
    expect(findReusableStory([base], new Set(six.slice(0, 5)), sixIds)).toBeUndefined() // one was archived
    expect(findReusableStory([base], sixIds, new Set(six.slice(0, 3)))).toBeUndefined() // half is not most
    expect(findReusableStory([base], sixIds, new Set(six.slice(0, 4)))).toBe(base)
    expect(findReusableStory([story()], everyone, everyone)).toBeUndefined() // four words are too few
  })
})

describe('the words of a story', () => {
  const pool = Object.values(entries)

  it('puts each target on its entry, in reading order', () => {
    const gaps = storyGaps(story(), pool)
    expect(gaps.map((gap) => [gap.index, gap.entry.lemma, gap.answer])).toEqual([
      [0, 'give up', 'gave up'],
      [1, 'queue', 'queue'],
      [2, 'go', 'went'],
      [3, 'pint', 'pint'],
    ])
  })

  it('drops a word whose entry is gone or was never part of the story, and numbers the rest again', () => {
    const gaps = storyGaps(story(), pool.filter((entry) => entry.lemma !== 'queue'))
    expect(gaps.map((gap) => gap.index)).toEqual([0, 1, 2])
    expect(gaps.map((gap) => gap.entry.lemma)).toEqual(['give up', 'go', 'pint'])
    expect(storyGaps(story({ entryIds: [] }), pool)).toEqual([])
  })

  it('cuts the text at every word and puts it back together exactly', () => {
    const segments = storySegments(TEXT, storyGaps(story(), pool))
    expect(segments.map((segment) => (segment.kind === 'text' ? segment.text : segment.gap.answer)).join('')).toBe(TEXT)
    expect(segments.filter((segment) => segment.kind === 'word')).toHaveLength(4)
    expect(segments[0]).toEqual({ kind: 'text', text: 'Tom ' })
    // A word at the very start or the very end leaves no empty piece of text.
    const edges = storySegments('Go home', [{ index: 0, entry: entries.go, answer: 'Go', start: 0, end: 2 }, { index: 1, entry: entries.pint, answer: 'home', start: 3, end: 7 }])
    expect(edges.map((segment) => segment.kind)).toEqual(['word', 'text', 'word'])
  })

  it('makes a bank with every answer once, shuffled', () => {
    const gaps = storyGaps(story(), pool)
    const bank = buildBank(gaps, seededRng(1))
    expect(bank.map((word) => word.text).sort()).toEqual(['gave up', 'pint', 'queue', 'went'])
    expect(new Set(bank.map((word) => word.id)).size).toBe(4)
    expect(new Set(Array.from({ length: 20 }, (_, seed) => buildBank(gaps, seededRng(seed)).map((word) => word.text).join())).size).toBeGreaterThan(5)
  })

  it('checks a gap whatever the letter case, and never accepts an empty gap', () => {
    const [first] = storyGaps(story(), pool)
    expect(first && isGapRight(first, 'gave up')).toBe(true)
    expect(first && isGapRight(first, 'Gave Up')).toBe(true)
    expect(first && isGapRight(first, 'give up')).toBe(false)
    expect(first && isGapRight(first, undefined)).toBe(false)
  })
})
