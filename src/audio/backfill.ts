import { db } from '../db/db.ts'
import { getActive, writeRecord } from '../db/repo.ts'
import { lookupDictionaryOutcome, type LookupOutcome } from '../lib/dictionary.ts'

/** Entries that have not been asked about a UK recording yet. */
export async function entriesNeedingAudio(limit = 20) {
  const all = await db.entries.toArray()
  return all
    .filter((entry) => entry.deletedAt === undefined && entry.status !== 'pending_ai' && !entry.audioUrl && !entry.audioCheckedAt)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
}

export interface BackfillDeps {
  lookup?: (word: string) => Promise<LookupOutcome>
  now?: () => number
  limit?: number
  /** Pause between lookups, to be gentle with a free service. */
  pauseMs?: number
}

/**
 * Looks up the UK recording of entries that lack one and stores it in `audioUrl`. Words the
 * dictionary does not know, or knows without a British recording, are marked as checked so they are
 * not asked again. It stops at the first "unavailable" answer (offline, service down) and tries
 * again next time. Resolves to the number of recordings found.
 */
export async function backfillAudioUrls(deps: BackfillDeps = {}): Promise<number> {
  const lookup = deps.lookup ?? ((word: string) => lookupDictionaryOutcome(word))
  const now = deps.now ?? Date.now
  let found = 0

  for (const waiting of await entriesNeedingAudio(deps.limit)) {
    const outcome = await lookup(waiting.lemma)
    if (outcome.kind === 'unavailable') break

    // Read it again: the user may have edited or deleted it while the lookup was running.
    const entry = await getActive('entries', waiting.id)
    if (entry && !entry.audioUrl) {
      const audioUrl = outcome.kind === 'found' ? outcome.result.audioUrl : ''
      await writeRecord('entries', { ...entry, ...(audioUrl ? { audioUrl } : {}), audioCheckedAt: now() })
      if (audioUrl) found += 1
    }
    if (deps.pauseMs) await new Promise((resolve) => setTimeout(resolve, deps.pauseMs))
  }
  return found
}
