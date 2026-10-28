import { useSyncExternalStore } from 'react'

export interface SyncFailure {
  code: string
  message: string
}

/** What is happening right now. The rest of the picture (pending records, last success) is in the database. */
export interface SyncStatus {
  running: boolean
  /** The failure of the last run, until a run succeeds. */
  error: SyncFailure | null
  /** Something was skipped on the last successful run (records the server refused or that did not validate). */
  warning: string | null
}

let state: SyncStatus = { running: false, error: null, warning: null }
const listeners = new Set<() => void>()

export function getSyncStatus(): SyncStatus {
  return state
}

export function setSyncStatus(patch: Partial<SyncStatus>): void {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, getSyncStatus, getSyncStatus)
}
