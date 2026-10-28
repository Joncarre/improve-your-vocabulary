import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { countEntriesNeedingAudio } from './needsAudio.ts'
import { preloadVoices } from './voices.ts'

const PAUSE_BETWEEN_LOOKUPS_MS = 300

/** One run at a time for the whole app, however many times React mounts the hook. */
let running = false

/**
 * Background audio work: loads the device's voices at start (so the first tap can speak at once)
 * and asks the free dictionary for the UK recording of words that do not have one yet — when the
 * app opens, when a word is added and when the connection comes back. The lookup code is only
 * loaded when there is something to look up.
 */
export function useAudioBackfill(): void {
  const waiting = useLiveQuery(countEntriesNeedingAudio, [], 0)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    void preloadVoices()
    const again = () => setAttempt((n) => n + 1)
    window.addEventListener('online', again)
    return () => window.removeEventListener('online', again)
  }, [])

  useEffect(() => {
    if (waiting === 0 || running || !navigator.onLine) return
    running = true
    void import('./backfill.ts')
      .then(({ runAudioBackfill }) => runAudioBackfill({ pauseMs: PAUSE_BETWEEN_LOOKUPS_MS }))
      .catch(() => undefined)
      .finally(() => {
        running = false
      })
  }, [waiting, attempt])
}
