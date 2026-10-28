import { describe, expect, it } from 'vitest'
import { formatClock } from '../../../src/features/games/format.ts'
import { loadVariant, saveVariant } from '../../../src/features/games/prefs.ts'

describe('formatClock', () => {
  it.each([
    [0, '0:00'],
    [7_400, '0:07'],
    [59_999, '0:59'],
    [65_000, '1:05'],
    [600_000, '10:00'],
    [-5, '0:00'],
  ])('%d ms is %s', (ms, expected) => {
    expect(formatClock(ms)).toBe(expected)
  })
})

describe('remembered version of a game', () => {
  it('does not fail where there is no local storage (private mode, tests)', () => {
    expect(loadVariant('cloze')).toBeUndefined()
    expect(() => saveVariant('cloze', 'type')).not.toThrow()
  })

  it('remembers each game apart when storage works', () => {
    const store = new Map<string, string>()
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value) },
    })
    try {
      saveVariant('cloze', 'type')
      saveVariant('match', 'ipa')
      expect(loadVariant('cloze')).toBe('type')
      expect(loadVariant('match')).toBe('ipa')
      expect(loadVariant('family')).toBeUndefined()
      store.set('vocab.games.v1', 'not json')
      expect(loadVariant('cloze')).toBeUndefined()
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original)
      else Reflect.deleteProperty(globalThis, 'localStorage')
    }
  })
})
