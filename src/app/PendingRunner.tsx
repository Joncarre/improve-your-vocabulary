import { usePendingCompletion } from '../ai/usePendingCompletion.ts'

/** Mounts the background completion of `pending_ai` entries; renders nothing. */
export function PendingRunner() {
  usePendingCompletion()
  return null
}
