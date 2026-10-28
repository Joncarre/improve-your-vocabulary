import { describe, expect, it, vi } from 'vitest'
import { createPlayer, SLOW_RATE, type PlayableAudio, type PlayerDeps } from '../../src/audio/player.ts'

const UK = 'https://api.dictionaryapi.dev/media/pronunciations/en/learnt-uk.mp3'
const US = 'https://api.dictionaryapi.dev/media/pronunciations/en/decide-us.mp3'

function setup(overrides: Partial<PlayerDeps> = {}) {
  const audios: Array<PlayableAudio & { rate?: number }> = []
  const deps: PlayerDeps = {
    fetchImpl: vi.fn(async () => new Response(new Blob(['mp3-bytes']), { status: 200 })),
    createAudio: vi.fn(() => {
      const audio: PlayableAudio & { rate?: number } = {
        play: vi.fn(async (rate: number) => {
          audio.rate = rate
        }),
        stop: vi.fn(),
      }
      audios.push(audio)
      return audio
    }),
    createObjectUrl: vi.fn(() => 'blob:fake'),
    revokeObjectUrl: vi.fn(),
    speak: vi.fn(async () => undefined),
    stopSpeaking: vi.fn(),
    prime: vi.fn(),
    recordingTimeoutMs: 50,
    ...overrides,
  }
  return { deps, player: createPlayer(deps), audios }
}

const request = { text: 'learnt', rate: 0.95 }

describe('player: the UK recording', () => {
  it('plays it when there is one, and never speaks', async () => {
    const { deps, player, audios } = setup()

    expect(await player.play({ ...request, audioUrl: UK })).toBe('recording')
    expect(deps.fetchImpl).toHaveBeenCalledWith(UK, expect.anything())
    expect(audios[0]?.rate).toBe(1)
    expect(deps.speak).not.toHaveBeenCalled()
    expect(deps.revokeObjectUrl).toHaveBeenCalledWith('blob:fake')
  })

  it('plays the recording at 0.7 for the slow button', async () => {
    const { audios, player } = setup()
    await player.play({ ...request, audioUrl: UK, slow: true })

    expect(audios[0]?.rate).toBe(SLOW_RATE)
  })

  it('unlocks speech inside the tap, before anything is awaited', async () => {
    const order: string[] = []
    const { player } = setup({
      prime: () => order.push('prime'),
      fetchImpl: vi.fn(async () => {
        order.push('fetch')
        return new Response(new Blob(['x']))
      }),
    })
    await player.play({ ...request, audioUrl: UK })

    expect(order).toEqual(['prime', 'fetch'])
  })

  it.each([
    ['a server error (the dictionary audio host often answers 502)', () => new Response('Bad Gateway', { status: 502 })],
    ['an empty file', () => new Response(new Blob([]), { status: 200 })],
  ])('hands over to speech on %s', async (_label, answer) => {
    const { deps, player } = setup({ fetchImpl: vi.fn(async () => answer()) })

    expect(await player.play({ ...request, audioUrl: UK })).toBe('speech')
    expect(deps.speak).toHaveBeenCalledWith('learnt', { rate: 0.95, voice: undefined })
  })

  it('hands over to speech when the download fails or takes too long', async () => {
    const failing = setup({
      fetchImpl: vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    })
    expect(await failing.player.play({ ...request, audioUrl: UK })).toBe('speech')

    const slow = setup({
      fetchImpl: vi.fn(
        (_url: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
      ),
    })
    expect(await slow.player.play({ ...request, audioUrl: UK })).toBe('speech')
  })

  it('hands over to speech when the browser refuses to play the recording (iOS without a tap)', async () => {
    const { deps, player } = setup({
      createAudio: () => ({
        play: async () => {
          throw new DOMException('not allowed', 'NotAllowedError')
        },
        stop: vi.fn(),
      }),
    })

    expect(await player.play({ ...request, audioUrl: UK })).toBe('speech')
    expect(deps.revokeObjectUrl).toHaveBeenCalled()
  })

  it('does not try a recording that failed again during the same session', async () => {
    const { deps, player } = setup({ fetchImpl: vi.fn(async () => new Response('x', { status: 502 })) })
    await player.play({ ...request, audioUrl: UK })
    await player.play({ ...request, audioUrl: UK })

    expect(deps.fetchImpl).toHaveBeenCalledOnce()
    expect(deps.speak).toHaveBeenCalledTimes(2)
  })

  it('ignores recordings that are not British', async () => {
    const { deps, player } = setup()

    expect(await player.play({ ...request, audioUrl: US })).toBe('speech')
    expect(deps.fetchImpl).not.toHaveBeenCalled()
  })
})

describe('player: the device voice', () => {
  it('speaks with the voice and speed it is given', async () => {
    const { deps, player } = setup()
    const voice = { name: 'Daniel' } as SpeechSynthesisVoice

    expect(await player.play({ text: 'decide', rate: 0.9, voice })).toBe('speech')
    expect(deps.speak).toHaveBeenCalledWith('decide', { rate: 0.9, voice })
  })

  it('uses 0.7 for the slow button', async () => {
    const { deps, player } = setup()
    await player.play({ text: 'decide', rate: 0.95, slow: true })

    expect(deps.speak).toHaveBeenCalledWith('decide', { rate: SLOW_RATE, voice: undefined })
  })

  it('stops what was playing before starting something new', async () => {
    const { deps, player } = setup()
    await player.play({ text: 'one', rate: 1 })

    expect(deps.stopSpeaking).toHaveBeenCalledOnce()
  })
})

describe('player: stopping', () => {
  it('a newer request wins: the older one reports that nothing played', async () => {
    let release: (() => void) | undefined
    const { player } = setup({
      speak: vi.fn(
        (text: string) =>
          new Promise<void>((resolve) => {
            if (text === 'first') release = resolve
            else resolve()
          }),
      ),
    })
    const first = player.play({ text: 'first', rate: 1 })
    const second = await player.play({ text: 'second', rate: 1 })
    release?.()

    expect(second).toBe('speech')
    expect(await first).toBe('none')
  })

  it('stop() silences the recording and the speech', async () => {
    const { deps, player } = setup()
    player.stop()

    expect(deps.stopSpeaking).toHaveBeenCalled()
  })
})
