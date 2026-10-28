import { describe, expect, it } from 'vitest'
import { buildMatchBoard, distinctForMatch, isPair, MATCH_PAIRS, otherSide, planMatch } from '../../src/games/match.ts'
import { seededRng } from '../../src/games/rng.ts'
import { entryOf, pickOptions, senseOf, wordOf } from './helpers.ts'

const words = Array.from({ length: 9 }, (_, i) => wordOf(entryOf(`word${i}`, 'noun')))

describe('what goes with the word', () => {
  const entry = entryOf('pint', 'noun')

  it('is the meaning, the English definition or the pronunciation of the main sense', () => {
    expect(otherSide(entry, 'es')).toBe('pint (es)')
    expect(otherSide(entry, 'definition')).toBe('the meaning of pint')
    expect(otherSide(entry, 'ipa')).toBe('/pint/')
  })

  it('is the sense of the sentence where the word was found, not just the first', () => {
    const second = senseOf({ meaningEs: 'otra', matchesContext: true })
    const first = senseOf({ meaningEs: 'primera', matchesContext: false })
    expect(otherSide({ ...entry, senses: [first, second] }, 'es')).toBe('otra')
  })
})

describe('distinctForMatch', () => {
  it('drops words with nothing to pair with (no pronunciation, no definition)', () => {
    const noIpa = wordOf(entryOf('mute', 'noun', { ipa: '' }))
    expect(distinctForMatch([...words, noIpa], 'ipa')).toHaveLength(9)
    expect(distinctForMatch([...words, noIpa], 'es')).toHaveLength(10)
  })

  it('never lets two tiles of the same side say the same thing', () => {
    const twin = wordOf(entryOf('twin', 'noun', { senses: [senseOf({ meaningEs: 'WORD0 (es)' })] }))
    expect(distinctForMatch([words[0] as (typeof words)[number], twin], 'es')).toHaveLength(1)
    const sameLemma = wordOf(entryOf('word0', 'verb'))
    expect(distinctForMatch([words[0] as (typeof words)[number], sameLemma], 'es')).toHaveLength(1)
  })
})

describe('buildMatchBoard', () => {
  it('makes twelve tiles: six words and the six things that go with them', () => {
    const board = buildMatchBoard(words, 'es', seededRng(2))
    expect(board.entries).toHaveLength(MATCH_PAIRS)
    expect(board.tiles).toHaveLength(12)
    expect(new Set(board.tiles.map((tile) => tile.id)).size).toBe(12)
    expect(board.tiles.filter((tile) => tile.side === 'word')).toHaveLength(6)
    expect(board.tiles.filter((tile) => tile.side === 'other').every((tile) => tile.kind === 'es')).toBe(true)
  })

  it('pairs each word with its own half, and with no other', () => {
    const board = buildMatchBoard(words, 'es', seededRng(2))
    const pairs = board.tiles.flatMap((a) => board.tiles.filter((b) => isPair(a, b)).map((b) => [a.id, b.id]))
    expect(pairs).toHaveLength(12) // each of the six pairs, in both directions
    const word = board.tiles.find((tile) => tile.side === 'word')
    expect(word && board.tiles.find((tile) => tile.entryId === word.entryId && tile.side === 'other')?.text).toContain('(es)')
  })

  it('marks the kind of tile per variant', () => {
    expect(buildMatchBoard(words, 'ipa', seededRng(1)).tiles.some((tile) => tile.kind === 'ipa')).toBe(true)
    expect(buildMatchBoard(words, 'definition', seededRng(1)).tiles.filter((tile) => tile.side === 'other').every((tile) => tile.kind === 'en')).toBe(true)
  })

  it('lays the tiles out differently with different seeds', () => {
    const layouts = new Set(Array.from({ length: 10 }, (_, seed) => buildMatchBoard(words, 'es', seededRng(seed)).tiles.map((tile) => tile.id).join()))
    expect(layouts.size).toBeGreaterThan(5)
  })
})

describe('planMatch', () => {
  it('needs six words that can sit together', () => {
    expect(planMatch(words.slice(0, 5), 'es', pickOptions())).toBeNull()
    expect(planMatch(words.slice(0, 6), 'es', pickOptions())?.tiles).toHaveLength(12)
  })

  it('skips a word without pronunciation instead of failing', () => {
    const noIpa = wordOf(entryOf('mute', 'noun', { ipa: '' }))
    expect(planMatch([...words.slice(0, 5), noIpa], 'ipa', pickOptions())).toBeNull()
    expect(planMatch([...words.slice(0, 6), noIpa], 'ipa', pickOptions())?.entries.some((entry) => entry.lemma === 'mute')).toBe(false)
  })

  it('draws six of many words, favouring the ones with more weight', () => {
    const target = words[0] as (typeof words)[number]
    let hits = 0
    for (let seed = 0; seed < 100; seed += 1) {
      const board = planMatch(words, 'es', pickOptions({ rng: seededRng(seed), boost: (word) => (word === target ? 30 : 1) }))
      if (board?.entries.some((entry) => entry.id === target.entry.id)) hits += 1
    }
    expect(hits).toBeGreaterThan(90)
  })
})
