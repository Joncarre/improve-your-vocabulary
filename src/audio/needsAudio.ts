import { db } from '../db/db.ts'
import type { Entry } from '../shared/index.ts'

/** Not asked about a UK recording yet (and not waiting for the AI, whose word may still change). */
export function needsAudio(entry: Entry): boolean {
  return entry.deletedAt === undefined && entry.status !== 'pending_ai' && !entry.audioUrl && !entry.audioCheckedAt
}

export function countEntriesNeedingAudio(): Promise<number> {
  return db.entries.filter(needsAudio).count()
}
