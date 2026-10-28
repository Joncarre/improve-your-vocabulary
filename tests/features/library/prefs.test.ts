import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PREFS, loadPrefs, savePrefs } from '../../../src/features/library/prefs.ts'

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('library preferences', () => {
  it('start from the defaults when nothing is stored', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    expect(loadPrefs()).toEqual(DEFAULT_PREFS)
  })

  it('remember the last view, filter and order', () => {
    const storage = fakeStorage()
    vi.stubGlobal('localStorage', storage)
    savePrefs({ view: 'topic', status: 'leech', sort: 'wrong' })
    expect(loadPrefs()).toEqual({ view: 'topic', status: 'leech', sort: 'wrong' })
  })

  it('ignore values that no longer exist instead of breaking the list', () => {
    vi.stubGlobal('localStorage', fakeStorage({ 'vocab.library.v1': JSON.stringify({ view: 'galaxy', status: 'mastered', sort: 42 }) }))
    expect(loadPrefs()).toEqual({ ...DEFAULT_PREFS, status: 'mastered' })
  })

  it('survive corrupt data, and storage that throws or is missing', () => {
    vi.stubGlobal('localStorage', fakeStorage({ 'vocab.library.v1': '{not json' }))
    expect(loadPrefs()).toEqual(DEFAULT_PREFS)
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(loadPrefs()).toEqual(DEFAULT_PREFS)
    expect(() => savePrefs(DEFAULT_PREFS)).not.toThrow()
    vi.unstubAllGlobals()
    expect(loadPrefs()).toEqual(DEFAULT_PREFS) // no localStorage at all (tests run in Node)
  })
})
