import { liveQuery } from 'dexie'
import { useSyncExternalStore } from 'react'
import { loadDeviceSettings } from '../db/settings.ts'
import { browserPlayer } from './browserPlayer.ts'
import type { PlaybackKind } from './player.ts'
import { pickVoice, cachedVoices } from './voices.ts'

/* Voice and speed come from this device's settings. They are kept in a module variable fed by one
   subscription, so every speaker button can read them synchronously inside its tap. */
let voiceSettings: { rate: number; voiceURI: string | undefined } = { rate: 0.95, voiceURI: undefined }
let subscribed = false

function followSettings() {
  if (subscribed) return
  subscribed = true
  liveQuery(() => loadDeviceSettings()).subscribe({
    next: (settings) => {
      voiceSettings = { rate: settings.voiceRate, voiceURI: settings.voiceURI }
    },
    error: () => undefined,
  })
}

let playingKey: string | null = null
const listeners = new Set<() => void>()

function setPlaying(key: string | null) {
  playingKey = key
  for (const listener of listeners) listener()
}

export interface AudioRequest {
  /** Identifies the button, so it can show that it is playing. */
  key: string
  text: string
  /** UK recording of the word, if the entry has one. */
  audioUrl?: string | undefined
  slow?: boolean
}

/**
 * Plays a word or sentence (starting a new one stops the previous). Call it directly from a tap handler.
 * The promise resolves when it ends, with what played; `none` means something else took over (or it was stopped),
 * which is how a caller chaining two sounds knows not to go on.
 */
export function playAudio(request: AudioRequest, overrides: { rate?: number; voiceURI?: string } = {}): Promise<PlaybackKind> {
  followSettings()
  const voice = pickVoice(cachedVoices(), overrides.voiceURI ?? voiceSettings.voiceURI)
  setPlaying(request.key)
  return browserPlayer()
    .play({
      text: request.text,
      audioUrl: request.audioUrl,
      rate: overrides.rate ?? voiceSettings.rate,
      voice,
      ...(request.slow ? { slow: true } : {}),
    })
    .finally(() => {
      if (playingKey === request.key) setPlaying(null)
    })
}

export function stopAudio(): void {
  browserPlayer().stop()
  setPlaying(null)
}

function subscribe(listener: () => void) {
  followSettings()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The key of the button that is playing right now, or null. */
export function usePlayingKey(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => playingKey,
    () => null,
  )
}
