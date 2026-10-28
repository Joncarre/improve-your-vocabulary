import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db } from '../db/db.ts'
import { useDeviceSettings } from '../db/settings.ts'
import { requestSync } from './scheduler.ts'

/** After a change, the sync waits for this long without further changes. */
const CHANGE_DEBOUNCE_MS = 5_000
const SECRET_DEBOUNCE_MS = 1_500
const INTERVAL_MS = 5 * 60_000

/**
 * The value once it has stopped changing for `delay` ms. The value read when the app opens counts
 * at once (`ready` is false until it has been read); only later edits wait.
 */
function useSettled<T>(value: T, delay: number, ready: boolean): T {
  const [settled, setSettled] = useState(value)
  const opened = useRef(false)
  useEffect(() => {
    if (!ready) return
    if (!opened.current) {
      opened.current = true
      setSettled(value)
      return
    }
    const timer = window.setTimeout(() => setSettled(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay, ready])
  return settled
}

/**
 * Decides when to synchronise (spec §10): when the app opens, when it comes back to the front or
 * the connection returns, about 5 s after each change, every 5 minutes while it is open, and when
 * the secret is entered. "Sincronizar ahora" calls `requestSync` directly.
 */
export function useSyncTriggers(): void {
  const { settings, ready } = useDeviceSettings()
  // The secret is typed letter by letter: wait until it stops changing.
  const secret = useSettled(settings.appSecret.trim(), SECRET_DEBOUNCE_MS, ready)
  // The time of the newest change waiting to be uploaded; 0 when nothing is.
  const lastChange = useLiveQuery(async () => (await db.outbox.orderBy('queuedAt').last())?.queuedAt ?? 0, [], 0)

  useEffect(() => {
    if (!ready || !secret) return
    void requestSync()
    const whenVisible = () => {
      if (document.visibilityState === 'visible') void requestSync()
    }
    const now = () => void requestSync()
    document.addEventListener('visibilitychange', whenVisible)
    window.addEventListener('online', now)
    const interval = window.setInterval(whenVisible, INTERVAL_MS)
    return () => {
      document.removeEventListener('visibilitychange', whenVisible)
      window.removeEventListener('online', now)
      window.clearInterval(interval)
    }
  }, [ready, secret])

  useEffect(() => {
    if (!ready || !secret || lastChange === 0) return
    const timer = window.setTimeout(() => void requestSync(), CHANGE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [ready, secret, lastChange])
}
