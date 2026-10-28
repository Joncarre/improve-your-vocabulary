import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db } from '../db/db.ts'
import { useDeviceSettings } from '../db/settings.ts'
import { showToast } from '../ui/toastStore.ts'

const RETRY_AFTER_MS = 60_000

/** One run at a time for the whole app, however many times React mounts the hook. */
let running = false

/**
 * Completes entries saved as `pending_ai` on its own: when the app opens, when the connection
 * comes back, whenever a new one is saved, and again a minute after a temporary failure.
 * The AI client is only loaded when there is something to complete.
 */
export function usePendingCompletion(): void {
  const { settings, ready } = useDeviceSettings()
  const waiting = useLiveQuery(
    () =>
      db.entries
        .where('status')
        .equals('pending_ai')
        .filter((entry) => entry.deletedAt === undefined)
        .count(),
    [],
    0,
  )
  const [attempt, setAttempt] = useState(0)
  const retryTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const again = () => setAttempt((n) => n + 1)
    window.addEventListener('online', again)
    return () => {
      window.removeEventListener('online', again)
      window.clearTimeout(retryTimer.current)
    }
  }, [])

  const secret = settings.appSecret.trim()
  useEffect(() => {
    if (!ready || waiting === 0 || !secret || running || !navigator.onLine) return
    running = true
    const retryLater = () => {
      window.clearTimeout(retryTimer.current)
      retryTimer.current = window.setTimeout(() => setAttempt((n) => n + 1), RETRY_AFTER_MS)
    }
    void import('./pending.ts')
      .then(async ({ listPendingEntries, processPendingEntries }) => {
        const run = await processPendingEntries({ secret })
        const done = run.completed + run.merged
        if (done > 0) showToast(done === 1 ? 'Una palabra completada' : `${done} palabras completadas`)
        if (run.failure?.retryable) retryLater()
        // Words saved while this run was going are picked up right away.
        else if (!run.failure && (await listPendingEntries()).length > 0) setAttempt((n) => n + 1)
      })
      .catch(retryLater)
      .finally(() => {
        running = false
      })
  }, [ready, waiting, secret, attempt])
}
