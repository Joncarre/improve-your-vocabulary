import { describe, expect, it } from 'vitest'
import { normalizeLemmaKey } from '../../src/lib/lemmaKey.ts'

describe('normalizeLemmaKey', () => {
  it.each([
    ['Go', 'go'],
    ['  Give   Up. ', 'give up'],
    ['go off on one!', 'go off on one'],
    ['(knackered)', 'knackered'],
    ['Café', 'cafe'],
    ['naïve', 'naive'],
    ['Don’t', "don't"],
    ['“cheers”', 'cheers'],
    ['well-known', 'well-known'],
    ['¿qué tal?', 'que tal'],
  ])('%j -> %j', (input, expected) => {
    expect(normalizeLemmaKey(input)).toBe(expected)
  })

  it('makes different spellings of the same entry collide', () => {
    expect(normalizeLemmaKey('GIVE UP')).toBe(normalizeLemmaKey(' give up. '))
  })

  it('returns an empty key for punctuation only', () => {
    expect(normalizeLemmaKey(' ... ')).toBe('')
  })
})
