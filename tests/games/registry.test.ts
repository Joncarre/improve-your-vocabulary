import { describe, expect, it } from 'vitest'
import { availability, GAMES, gameInfo, playableCount, resolveVariant } from '../../src/games/registry.ts'
import { suggestGame } from '../../src/games/suggestion.ts'
import { entryOf, familyOf, member, senseOf, verbOf, wordOf, DAY, NOW } from './helpers.ts'

const info = (id: string) => gameInfo(id) as NonNullable<ReturnType<typeof gameInfo>>

const nouns = (count: number, extra = {}) => Array.from({ length: count }, (_, i) => wordOf(entryOf(`noun${i}`, 'noun', extra)))
const verbs = (count: number) => Array.from({ length: count }, (_, i) => wordOf(verbOf(`verb${i}`, [`past${i}`], [`part${i}`])))

describe('the games', () => {
  it('asks for the minimum of words of the spec', () => {
    expect(GAMES.filter((game) => game.ready).map((game) => [game.id, game.min])).toEqual([
      ['match', 6],
      ['cloze', 4],
      ['verb_forms', 5],
      ['family', 4],
    ])
  })

  it('keeps the games of the next phase locked, with the minimum of the spec', () => {
    for (const id of ['dictation', 'connections', 'story'] as const) {
      expect(info(id).ready).toBe(false)
      expect(availability(info(id), nouns(30), '').open).toBe(false)
    }
    expect(info('dictation').min).toBe(5)
    expect(info('connections').min).toBe(16)
  })

  it('has variants where the spec has levels or modes, and falls back to the default for an unknown one', () => {
    expect(info('match').variants?.options.map((option) => option.value)).toEqual(['es', 'definition', 'ipa'])
    expect(resolveVariant(info('match'), 'ipa')).toBe('ipa')
    expect(resolveVariant(info('match'), 'nope')).toBe('es')
    expect(resolveVariant(info('cloze'), null)).toBe('choose')
    expect(resolveVariant(info('family'), undefined)).toBe('mixed')
  })
})

describe('availability', () => {
  it('Parejas opens with six words and stays locked with five', () => {
    expect(availability(info('match'), nouns(5), 'es')).toEqual({ playable: 5, min: 6, open: false })
    expect(availability(info('match'), nouns(6), 'es')).toEqual({ playable: 6, min: 6, open: true })
  })

  it('counts only the words that can be played in that variant', () => {
    const words = [...nouns(6), wordOf(entryOf('mute', 'noun', { ipa: '' }))]
    expect(playableCount('match', words, 'es')).toBe(7)
    expect(playableCount('match', words, 'ipa')).toBe(6)
  })

  it('Huecos needs words with a sentence where the word shows; Formas verbales needs verbs with both forms', () => {
    const lost = wordOf(entryOf('apple', 'noun', { senses: [senseOf({ examples: [{ en: 'It was good.', es: 'Estaba bien.' }] })] }))
    expect(playableCount('cloze', [...nouns(3), lost], '')).toBe(3)
    expect(playableCount('verb_forms', [...nouns(5), ...verbs(4)], '')).toBe(4)
    expect(availability(info('verb_forms'), verbs(5), 'choose').open).toBe(true)
    expect(availability(info('verb_forms'), verbs(4), 'choose').open).toBe(false)
  })

  it('Familias needs words with a family', () => {
    const family = Array.from({ length: 4 }, (_, i) => wordOf(familyOf(`root${i}`, 'verb', [member(`noun${i}`, 'noun', `A noun${i} here.`), member(`adj${i}`, 'adjective', `An adj${i} here.`)])))
    expect(availability(info('family'), [...nouns(5), ...family.slice(0, 3)], 'mixed').open).toBe(false)
    expect(availability(info('family'), [...nouns(5), ...family], 'mixed').open).toBe(true)
  })
})

describe('suggestGame', () => {
  const words = [...nouns(8), ...verbs(6)].map((word, i) => ({ ...word, entry: { ...word.entry, id: `w${i}` } }))

  it('suggests a game that can be played with the words already seen', () => {
    const suggestion = suggestGame(words, NOW, 4)
    expect(suggestion).not.toBeNull()
    expect(['match', 'cloze', 'verb_forms']).toContain(suggestion?.game)
    expect(suggestion?.words).toBeGreaterThanOrEqual(4)
  })

  it('is the same all day and may change the next day', () => {
    expect(suggestGame(words, NOW, 4)?.game).toBe(suggestGame(words, NOW + 3_600_000, 4)?.game)
    const games = new Set(Array.from({ length: 14 }, (_, day) => suggestGame(words, NOW + day * DAY, 4)?.game))
    expect(games.size).toBeGreaterThan(1)
  })

  it('ignores the words not yet seen and suggests nothing when no game is open', () => {
    expect(suggestGame(words.map((word) => ({ ...word, seen: false })), NOW, 4)).toBeNull()
    expect(suggestGame([], NOW, 4)).toBeNull()
    expect(suggestGame(nouns(3), NOW, 4)).toBeNull()
  })
})
