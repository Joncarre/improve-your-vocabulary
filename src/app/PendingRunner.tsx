import { usePendingCompletion } from '../ai/usePendingCompletion.ts'
import { useAudioBackfill } from '../audio/useAudioBackfill.ts'
import { useSyncTriggers } from '../sync/useSyncTriggers.ts'

/** Mounts the background jobs (completing `pending_ai` entries, voices and UK recordings, synchronisation); renders nothing. */
export function PendingRunner() {
  usePendingCompletion()
  useAudioBackfill()
  useSyncTriggers()
  return null
}
