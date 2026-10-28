import { createPlayer, type PlayableAudio, type Player } from './player.ts'
import { primeSpeech, speakText, stopSpeaking } from './speech.ts'

function createBrowserAudio(objectUrl: string): PlayableAudio {
  const audio = new Audio(objectUrl)
  let settle: (() => void) | undefined
  return {
    play: (playbackRate) =>
      new Promise<void>((resolve, reject) => {
        settle = resolve
        audio.playbackRate = playbackRate
        audio.onended = () => resolve()
        audio.onerror = () => reject(new Error('The recording could not be played.'))
        // iOS rejects play() when it does not start from a tap: the caller falls back to speech.
        audio.play().catch(reject)
      }),
    stop: () => {
      audio.pause()
      audio.onended = null
      audio.onerror = null
      settle?.()
    },
  }
}

let player: Player | undefined

/** The player the app uses: UK recording first (short timeout), then the device's en-GB voice. */
export function browserPlayer(): Player {
  player ??= createPlayer({
    fetchImpl: (input, init) => fetch(input, init),
    createAudio: createBrowserAudio,
    createObjectUrl: (blob) => URL.createObjectURL(blob),
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
    speak: speakText,
    stopSpeaking,
    prime: primeSpeech,
    recordingTimeoutMs: 3_000,
  })
  return player
}
