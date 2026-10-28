/** The few fields of a `SpeechSynthesisVoice` this module needs (so plain objects work in tests). */
export interface VoiceLike {
  voiceURI: string
  name: string
  lang: string
  localService: boolean
}

/** British English voices are tagged `en-GB` (some Android engines use `en_GB`). */
export function isBritishVoice(voice: Pick<VoiceLike, 'lang'>): boolean {
  return /^en[-_]gb$/i.test(voice.lang)
}

/**
 * Rough quality ranking: the enhanced/premium voices iOS and macOS let you download and the neural
 * "Natural" voices of Edge sound far better than the default ones. Offline voices get a small bonus.
 */
export function scoreVoice(voice: VoiceLike): number {
  const name = voice.name.toLowerCase()
  let score = 0
  if (/premium/.test(name)) score += 110
  else if (/enhanced/.test(name)) score += 100
  if (/natural|neural/.test(name)) score += 90
  if (/google/.test(name)) score += 40
  if (/\b(daniel|serena|kate|oliver|stephanie|libby|sonia|ryan|hazel|george|susan)\b/.test(name)) score += 20
  if (voice.localService) score += 5
  return score
}

/** British voices, best first (ties by name so the order is stable). */
export function britishVoices<T extends VoiceLike>(voices: readonly T[]): T[] {
  return voices
    .filter(isBritishVoice)
    .sort((a, b) => scoreVoice(b) - scoreVoice(a) || a.name.localeCompare(b.name))
}

/** The voice chosen in Ajustes if it is still there, otherwise the best British one. */
export function pickVoice<T extends VoiceLike>(voices: readonly T[], preferredURI?: string): T | undefined {
  if (preferredURI) {
    const chosen = voices.find((voice) => voice.voiceURI === preferredURI)
    if (chosen) return chosen
  }
  return britishVoices(voices)[0]
}

/**
 * On iOS `getVoices()` is often empty at first and fills in later: wait for `voiceschanged`, but
 * never for long, because speech must work even when the list never arrives.
 */
export function loadVoices(synth: SpeechSynthesis | undefined = currentSynth(), timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (!synth) return Promise.resolve([])
  const ready = synth.getVoices()
  if (ready.length > 0) return Promise.resolve(ready)

  return new Promise((resolve) => {
    const finish = () => {
      synth.removeEventListener('voiceschanged', finish)
      clearTimeout(timer)
      resolve(synth.getVoices())
    }
    const timer = setTimeout(finish, timeoutMs)
    synth.addEventListener('voiceschanged', finish)
  })
}

function currentSynth(): SpeechSynthesis | undefined {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined
}

let cached: SpeechSynthesisVoice[] = []

/** Voices loaded so far, available synchronously (speech on iOS must start inside the tap). */
export function cachedVoices(): SpeechSynthesisVoice[] {
  return cached
}

/** Loads the voice list once at start so `cachedVoices()` is ready by the first tap. */
export async function preloadVoices(): Promise<SpeechSynthesisVoice[]> {
  cached = await loadVoices()
  return cached
}
