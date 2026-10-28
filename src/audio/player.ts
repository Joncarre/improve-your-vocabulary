import { isUkAudio } from '../lib/dictionary.ts'
import type { SpeakOptions } from './speech.ts'

/** A recording being played: `play` resolves when it ends and rejects if it cannot play. */
export interface PlayableAudio {
  play: (playbackRate: number) => Promise<void>
  stop: () => void
}

export interface PlayerDeps {
  fetchImpl: typeof fetch
  createAudio: (objectUrl: string) => PlayableAudio
  createObjectUrl: (blob: Blob) => string
  revokeObjectUrl: (url: string) => void
  speak: (text: string, options: SpeakOptions) => Promise<void>
  stopSpeaking: () => void
  /** Unlocks speech inside the tap, before anything is awaited. */
  prime: () => void
  /** How long a recording may take to download before speech takes over. */
  recordingTimeoutMs: number
}

export interface PlayRequest {
  text: string
  /** UK recording of the word, if known. */
  audioUrl?: string | undefined
  rate: number
  voice?: SpeechSynthesisVoice | undefined
  slow?: boolean
}

/** What actually played: the recording, the device voice, or nothing. */
export type PlaybackKind = 'recording' | 'speech' | 'none'

export const SLOW_RATE = 0.7

export interface Player {
  play: (request: PlayRequest) => Promise<PlaybackKind>
  stop: () => void
}

/**
 * Plays a word with the UK recording when there is a working one, and with the device's British
 * voice otherwise. The free dictionary's audio server is unreliable, so a recording that fails to
 * arrive quickly (or at all) hands over to speech at once and is not tried again this session.
 */
export function createPlayer(deps: PlayerDeps): Player {
  const failed = new Set<string>()
  let ticket = 0
  let current: PlayableAudio | undefined

  const stop = () => {
    ticket += 1
    current?.stop()
    current = undefined
    deps.stopSpeaking()
  }

  async function fetchRecording(url: string): Promise<Blob> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), deps.recordingTimeoutMs)
    try {
      const response = await deps.fetchImpl(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      if (blob.size === 0) throw new Error('empty recording')
      return blob
    } finally {
      clearTimeout(timer)
    }
  }

  const play = async (request: PlayRequest): Promise<PlaybackKind> => {
    stop()
    const mine = ticket
    deps.prime()
    const rate = request.slow ? SLOW_RATE : request.rate

    const url = request.audioUrl
    if (url && isUkAudio(url) && !failed.has(url)) {
      let objectUrl: string | undefined
      try {
        const blob = await fetchRecording(url)
        if (mine !== ticket) return 'none'
        objectUrl = deps.createObjectUrl(blob)
        const audio = deps.createAudio(objectUrl)
        current = audio
        await audio.play(request.slow ? SLOW_RATE : 1)
        return mine === ticket ? 'recording' : 'none'
      } catch {
        failed.add(url)
        if (mine !== ticket) return 'none'
      } finally {
        if (objectUrl) deps.revokeObjectUrl(objectUrl)
      }
    }

    await deps.speak(request.text, { rate, voice: request.voice })
    return mine === ticket ? 'speech' : 'none'
  }

  return { play, stop }
}
