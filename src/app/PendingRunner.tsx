import { usePendingCompletion } from '../ai/usePendingCompletion.ts'
import { useAudioBackfill } from '../audio/useAudioBackfill.ts'

/** Mounts the background jobs (completing `pending_ai` entries, voices and UK recordings); renders nothing. */
export function PendingRunner() {
  usePendingCompletion()
  useAudioBackfill()
  return null
}
