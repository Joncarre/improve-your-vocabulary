import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canSpeak, primeSpeech, speakText } from '../../src/audio/speech.ts'

class FakeUtterance {
  text: string
  lang = ''
  rate = 1
  volume = 1
  voice: unknown = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(text: string) {
    this.text = text
  }
}

function installSpeech(options: { speaking?: boolean } = {}) {
  const spoken: FakeUtterance[] = []
  const synth = {
    speaking: options.speaking ?? false,
    pending: false,
    speak: vi.fn((utterance: FakeUtterance) => {
      spoken.push(utterance)
    }),
    cancel: vi.fn(),
  }
  vi.stubGlobal('window', { speechSynthesis: synth })
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  return { synth, spoken }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('speakText', () => {
  it('always speaks British English, even without a voice object', async () => {
    const { spoken } = installSpeech()
    const done = speakText('Cheers, mate')

    expect(spoken).toHaveLength(1)
    expect(spoken[0]).toMatchObject({ text: 'Cheers, mate', lang: 'en-GB', voice: null })
    spoken[0]?.onend?.()
    await done
  })

  it('uses the voice and speed it is given, within safe limits', async () => {
    const { spoken } = installSpeech()
    const voice = { name: 'Daniel' } as SpeechSynthesisVoice
    const first = speakText('one', { voice, rate: 0.7 })
    spoken[0]?.onend?.()
    await first
    const second = speakText('two', { rate: 9 })
    spoken[1]?.onend?.()
    await second

    expect(spoken[0]).toMatchObject({ voice, rate: 0.7, lang: 'en-GB' })
    expect(spoken[1]?.rate).toBe(1.5)
  })

  it('defaults to 0.95', async () => {
    const { spoken } = installSpeech()
    const done = speakText('hello')
    spoken[0]?.onend?.()
    await done

    expect(spoken[0]?.rate).toBe(0.95)
  })

  it('resolves when the speech fails instead of leaving the caller waiting', async () => {
    const { spoken } = installSpeech()
    const done = speakText('hello')
    spoken[0]?.onerror?.()

    await expect(done).resolves.toBeUndefined()
  })

  it('gives up waiting for an engine that never reports the end', async () => {
    installSpeech()
    const done = speakText('hello')
    await vi.advanceTimersByTimeAsync(4_000)

    await expect(done).resolves.toBeUndefined()
  })

  it('cancels what is being said and starts the new speech a moment later (iOS drops it otherwise)', async () => {
    const { synth, spoken } = installSpeech({ speaking: true })
    const done = speakText('hello')

    expect(synth.cancel).toHaveBeenCalledOnce()
    expect(spoken).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(60)
    expect(spoken).toHaveLength(1)
    spoken[0]?.onend?.()
    await done
  })

  it('says nothing for blank text or when speech is not available', async () => {
    const { spoken } = installSpeech()
    await speakText('   ')
    expect(spoken).toHaveLength(0)

    vi.unstubAllGlobals()
    await expect(speakText('hello')).resolves.toBeUndefined()
    expect(canSpeak()).toBe(false)
  })
})

describe('primeSpeech', () => {
  it('speaks one silent empty utterance, only once', () => {
    const { synth, spoken } = installSpeech()
    primeSpeech()
    primeSpeech()

    expect(synth.speak).toHaveBeenCalledOnce()
    expect(spoken[0]).toMatchObject({ text: '', volume: 0, lang: 'en-GB' })
  })
})
