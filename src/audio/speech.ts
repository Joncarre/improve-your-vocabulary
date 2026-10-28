export interface SpeakOptions {
  /** 0.95 by default, 0.7 for the "slow" button. */
  rate?: number
  voice?: SpeechSynthesisVoice | undefined
}

const MIN_RATE = 0.5
const MAX_RATE = 1.5

function synth(): SpeechSynthesis | undefined {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined
}

export function canSpeak(): boolean {
  return synth() !== undefined && typeof SpeechSynthesisUtterance !== 'undefined'
}

let primed = false

/**
 * iOS only lets speech start from a tap. Speaking an empty utterance synchronously inside the first
 * tap "unlocks" it for the rest of the session, even when the real audio starts later (after a fetch).
 */
export function primeSpeech(): void {
  if (primed || !canSpeak()) return
  primed = true
  const utterance = new SpeechSynthesisUtterance('')
  utterance.volume = 0
  utterance.lang = 'en-GB'
  synth()?.speak(utterance)
}

export function stopSpeaking(): void {
  synth()?.cancel()
}

/**
 * Speaks `text` in British English. `lang` is always en-GB, even when no voice object was found,
 * so the system still picks a British voice. Resolves when the speech ends or is cancelled.
 */
export function speakText(text: string, options: SpeakOptions = {}): Promise<void> {
  const engine = synth()
  if (!engine || !text.trim()) return Promise.resolve()

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-GB'
    if (options.voice) utterance.voice = options.voice
    utterance.rate = Math.min(MAX_RATE, Math.max(MIN_RATE, options.rate ?? 0.95))

    // Some engines never fire `end` (and long text can stall): never leave the caller waiting.
    const safety = setTimeout(resolve, Math.max(4_000, text.length * 150))
    const done = () => {
      clearTimeout(safety)
      resolve()
    }
    utterance.onend = done
    utterance.onerror = done

    // Speaking right after `cancel()` can be dropped by iOS: leave it a moment.
    if (engine.speaking || engine.pending) {
      engine.cancel()
      setTimeout(() => engine.speak(utterance), 60)
    } else {
      engine.speak(utterance)
    }
  })
}
