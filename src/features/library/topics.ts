import { db } from '../../db/db.ts'
import { getActive, listActive, softDeleteRecord, writeRecord } from '../../db/repo.ts'
import { normalizeLemmaKey } from '../../lib/lemmaKey.ts'
import { TOPIC_COLORS } from '../../lib/palette.ts'
import type { Entry, Source, Topic } from '../../shared/index.ts'

/** At most this many topics per word (spec §9). */
export const MAX_TOPICS_PER_ENTRY = 2

/** Words per topic, counting only entries that have not been deleted. */
export function topicUsage(entries: readonly Entry[]): Map<string, number> {
  const usage = new Map<string, number>()
  for (const entry of entries) {
    if (entry.deletedAt !== undefined) continue
    for (const id of entry.topicIds) usage.set(id, (usage.get(id) ?? 0) + 1)
  }
  return usage
}

/** First grapheme of what was typed, so an emoji with modifiers stays whole and nothing else gets in. */
export function firstGrapheme(text: string): string {
  const trimmed = text.trim()
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const first = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(trimmed)[Symbol.iterator]().next()
    return first.done ? '' : first.value.segment
  }
  return Array.from(trimmed)[0] ?? ''
}

export type TopicEditResult =
  | { ok: true; topic: Topic }
  | { ok: false; reason: 'empty' | 'duplicate' | 'missing' | 'color'; message: string }

export interface TopicEdit {
  nameEs?: string
  emoji?: string
  color?: string
}

/** Renames a topic or changes its emoji or colour. Two topics cannot share a name: merge them instead. */
export async function editTopic(id: string, edit: TopicEdit, now = Date.now()): Promise<TopicEditResult> {
  const topic = await getActive('topics', id)
  if (!topic) return { ok: false, reason: 'missing', message: 'Este tema ya no existe.' }

  const nameEs = (edit.nameEs ?? topic.nameEs).trim()
  if (!nameEs) return { ok: false, reason: 'empty', message: 'El tema necesita un nombre.' }

  if (edit.color !== undefined && !isTopicColor(edit.color)) {
    return { ok: false, reason: 'color', message: 'Elige uno de los colores de la paleta.' }
  }

  const key = normalizeLemmaKey(nameEs)
  const clash = (await listActive('topics')).find((other) => other.id !== id && normalizeLemmaKey(other.nameEs) === key)
  if (clash) {
    return { ok: false, reason: 'duplicate', message: `Ya existe el tema «${clash.nameEs}». Si son lo mismo, fusiónalos.` }
  }

  const emoji = edit.emoji === undefined ? topic.emoji : firstGrapheme(edit.emoji)
  const color = edit.color ?? topic.color
  return { ok: true, topic: await writeRecord('topics', { ...topic, nameEs, emoji, color }, { now }) }
}

/**
 * Moves every word of `sourceId` to `targetId` and marks the first topic as deleted (logically, so
 * the deletion reaches the other device). A word that had both stays with just the target, and a
 * word never ends up with more than two topics. Resolves to how many words changed.
 */
export async function mergeTopics(sourceId: string, targetId: string, now = Date.now()): Promise<number> {
  if (sourceId === targetId) return 0
  return db.transaction('rw', [db.topics, db.entries, db.outbox], async () => {
    const [from, into] = await Promise.all([getActive('topics', sourceId), getActive('topics', targetId)])
    if (!from || !into) return 0

    let moved = 0
    for (const entry of await db.entries.where('topicIds').equals(sourceId).toArray()) {
      if (entry.deletedAt !== undefined) continue
      const topicIds = [...new Set(entry.topicIds.map((id) => (id === sourceId ? targetId : id)))].slice(0, MAX_TOPICS_PER_ENTRY)
      await writeRecord('entries', { ...entry, topicIds }, { now })
      moved += 1
    }
    await softDeleteRecord('topics', sourceId, { now })
    return moved
  })
}

/** The words where a series or film appeared, newest first. */
export function entriesOfSource(entries: readonly Entry[], sourceId: Source['id']): Entry[] {
  return entries
    .filter((entry) => entry.deletedAt === undefined && entry.contexts.some((context) => context.sourceId === sourceId))
    .sort((a, b) => b.createdAt - a.createdAt)
}

/** True when `color` is one of the pastel colours topics can take. */
export function isTopicColor(color: string): boolean {
  return (TOPIC_COLORS as readonly string[]).includes(color.toLowerCase())
}
