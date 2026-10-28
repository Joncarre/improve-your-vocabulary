import { describe, expect, it, vi } from 'vitest'
import { britishVoices, isBritishVoice, loadVoices, pickVoice, scoreVoice, type VoiceLike } from '../../src/audio/voices.ts'

const voice = (name: string, lang = 'en-GB', localService = true): VoiceLike => ({ voiceURI: `uri:${name}`, name, lang, localService })

describe('isBritishVoice', () => {
  it.each([
    ['en-GB', true],
    ['en_GB', true],
    ['EN-gb', true],
    ['en-US', false],
    ['en-AU', false],
    ['es-ES', false],
  ])('%s -> %s', (lang, expected) => {
    expect(isBritishVoice({ lang })).toBe(expected)
  })
})

describe('voice ranking', () => {
  it('prefers downloaded enhanced and premium voices, then neural ones, then known good names', () => {
    const premium = voice('Serena (Premium)')
    const enhanced = voice('Daniel (Enhanced)')
    const neural = voice('Microsoft Sonia Online (Natural) - English (United Kingdom)', 'en-GB', false)
    const known = voice('Kate')
    const plain = voice('Some Voice')

    expect(britishVoices([plain, known, neural, enhanced, premium]).map((v) => v.name)).toEqual([
      'Serena (Premium)',
      'Daniel (Enhanced)',
      'Microsoft Sonia Online (Natural) - English (United Kingdom)',
      'Kate',
      'Some Voice',
    ])
  })

  it('leaves out voices that are not British', () => {
    expect(britishVoices([voice('Samantha', 'en-US'), voice('Daniel')]).map((v) => v.name)).toEqual(['Daniel'])
  })

  it('gives a small bonus to voices that work offline and orders ties by name', () => {
    expect(scoreVoice(voice('Zed', 'en-GB', true))).toBeGreaterThan(scoreVoice(voice('Zed', 'en-GB', false)))
    expect(britishVoices([voice('Beta'), voice('Alpha')]).map((v) => v.name)).toEqual(['Alpha', 'Beta'])
  })
})

describe('pickVoice', () => {
  const voices = [voice('Daniel (Enhanced)'), voice('Kate'), voice('Samantha', 'en-US')]

  it('uses the voice chosen in Ajustes when it still exists', () => {
    expect(pickVoice(voices, 'uri:Kate')?.name).toBe('Kate')
  })

  it('falls back to the best British voice when the chosen one is gone or none is chosen', () => {
    expect(pickVoice(voices, 'uri:Removed')?.name).toBe('Daniel (Enhanced)')
    expect(pickVoice(voices)?.name).toBe('Daniel (Enhanced)')
  })

  it('is undefined when the device has no British voice (speech then relies on lang = en-GB)', () => {
    expect(pickVoice([voice('Samantha', 'en-US')])).toBeUndefined()
    expect(pickVoice([])).toBeUndefined()
  })
})

describe('loadVoices', () => {
  function fakeSynth(initial: SpeechSynthesisVoice[]) {
    let current = initial
    const listeners = new Set<() => void>()
    const synth = {
      getVoices: () => current,
      addEventListener: (_type: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_type: string, fn: () => void) => listeners.delete(fn),
    } as unknown as SpeechSynthesis
    return {
      synth,
      fill: (voices: SpeechSynthesisVoice[]) => {
        current = voices
        for (const fn of [...listeners]) fn()
      },
      listeners,
    }
  }
  const one = [{ name: 'Daniel', lang: 'en-GB' }] as unknown as SpeechSynthesisVoice[]

  it('returns at once when the list is already there', async () => {
    expect(await loadVoices(fakeSynth(one).synth, 50)).toBe(one)
  })

  it('waits for voiceschanged when the list starts empty (iOS)', async () => {
    const { synth, fill, listeners } = fakeSynth([])
    const pending = loadVoices(synth, 1000)
    fill(one)

    expect(await pending).toBe(one)
    expect(listeners.size).toBe(0)
  })

  it('stops waiting after the timeout so speech still works without a list', async () => {
    vi.useFakeTimers()
    const { synth, listeners } = fakeSynth([])
    const pending = loadVoices(synth, 1500)
    await vi.advanceTimersByTimeAsync(1500)

    expect(await pending).toEqual([])
    expect(listeners.size).toBe(0)
    vi.useRealTimers()
  })

  it('resolves to an empty list when the browser has no speech synthesis', async () => {
    expect(await loadVoices(undefined)).toEqual([])
  })
})
