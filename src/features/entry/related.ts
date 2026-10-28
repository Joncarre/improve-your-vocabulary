import { normalizeLemmaKey } from '../../lib/lemmaKey.ts'
import type { Entry } from '../../shared/index.ts'

export type RelatedReason = 'family' | 'topic' | 'source'

export interface RelatedEntry {
  entry: Entry
  reason: RelatedReason
}

export const MAX_RELATED = 8

function sourceIds(entry: Entry): Set<string> {
  return new Set(entry.contexts.flatMap((context) => (context.sourceId ? [context.sourceId] : [])))
}

/**
 * Other entries of the collection related to this one, best reason first: same word family, then
 * same topic, then same series or film. Archived and deleted entries are left out.
 */
export function findRelated(entry: Entry, others: readonly Entry[], max = MAX_RELATED): RelatedEntry[] {
  const familyKeys = new Set(entry.family.map((member) => normalizeLemmaKey(member.word)))
  const ownKey = normalizeLemmaKey(entry.lemma)
  const ownSources = sourceIds(entry)

  const reasonFor = (other: Entry): RelatedReason | undefined => {
    if (
      familyKeys.has(other.lemmaKey) ||
      other.family.some((member) => normalizeLemmaKey(member.word) === ownKey)
    ) {
      return 'family'
    }
    if (other.topicIds.some((id) => entry.topicIds.includes(id))) return 'topic'
    for (const id of sourceIds(other)) if (ownSources.has(id)) return 'source'
    return undefined
  }

  const order: Record<RelatedReason, number> = { family: 0, topic: 1, source: 2 }
  return others
    .filter((other) => other.id !== entry.id && other.deletedAt === undefined && other.status !== 'archived')
    .flatMap((other) => {
      const reason = reasonFor(other)
      return reason ? [{ entry: other, reason }] : []
    })
    .sort((a, b) => order[a.reason] - order[b.reason] || b.entry.createdAt - a.entry.createdAt)
    .slice(0, max)
}
