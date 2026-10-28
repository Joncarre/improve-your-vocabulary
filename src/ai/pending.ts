import { db } from '../db/db.ts'
import { getActive, listActive, softDeleteRecord, writeRecord } from '../db/repo.ts'
import { buildDraftFromAi } from '../features/add/draft.ts'
import { loadTopicsForPrompt } from '../features/add/save.ts'
import { normalizeLemmaKey } from '../lib/lemmaKey.ts'
import { newId } from '../lib/id.ts'
import { pickTopicColor } from '../lib/palette.ts'
import type { Context, EnrichOutput, Entry, Topic } from '../shared/index.ts'
import { AiError, requestEnrich } from './client.ts'

export type CompletionOutcome = 'completed' | 'merged'

async function resolveNewTopicId(output: EnrichOutput, now: number): Promise<string[]> {
  if (!output.newTopic) return []
  const topics = await listActive('topics')
  const key = normalizeLemmaKey(output.newTopic.nameEs)
  const topic: Topic =
    topics.find((candidate) => normalizeLemmaKey(candidate.nameEs) === key) ??
    (await writeRecord(
      'topics',
      {
        id: newId(),
        nameEs: output.newTopic.nameEs,
        emoji: output.newTopic.emoji || '🏷️',
        color: pickTopicColor(topics.map((candidate) => candidate.color)),
        updatedAt: now,
      },
      { now },
    ))
  return [topic.id]
}

/**
 * Applies the AI's answer to an entry that was saved while the AI was unavailable. The AI owns
 * senses, forms, family, notes and IPA; the user's own data (contexts, topics, creation date)
 * stays. If the real lemma turns out to be an entry the user already has (they typed "went" and
 * had "go"), the contexts move there and this entry is deleted instead.
 */
export async function applyEnrichToEntry(entry: Entry, output: EnrichOutput, now = Date.now()): Promise<CompletionOutcome> {
  const draft = buildDraftFromAi(output, entry.lemma)
  const lemmaKey = normalizeLemmaKey(draft.lemma)

  return db.transaction('rw', [db.entries, db.cards, db.topics, db.outbox], async () => {
    const same = (await db.entries.where('lemmaKey').equals(lemmaKey).toArray()).find(
      (other) => other.id !== entry.id && other.deletedAt === undefined,
    )

    if (same) {
      const known = new Set(same.contexts.map((context) => normalizeLemmaKey(context.sentence)))
      const moved: Context[] = entry.contexts.filter((context) => !known.has(normalizeLemmaKey(context.sentence)))
      if (moved.length > 0) await writeRecord('entries', { ...same, contexts: [...same.contexts, ...moved] }, { now })
      await softDeleteRecord('entries', entry.id, { now })
      for (const card of await db.cards.where('entryId').equals(entry.id).toArray()) {
        await softDeleteRecord('cards', card.id, { now })
      }
      return 'merged'
    }

    const [first, ...rest] = entry.contexts
    const contexts: Context[] = first
      ? [
          {
            ...first,
            ...(first.translationEs || !draft.contextTranslationEs ? {} : { translationEs: draft.contextTranslationEs }),
            ...(first.surface || !draft.contextSurface ? {} : { surface: draft.contextSurface }),
          },
          ...rest,
        ]
      : []
    const topicIds = entry.topicIds.length > 0 ? entry.topicIds : [...output.topicIds, ...(await resolveNewTopicId(output, now))].slice(0, 2)

    await writeRecord(
      'entries',
      {
        ...entry,
        lemma: draft.lemma,
        lemmaKey,
        ...(draft.seenForm ? { seenForm: draft.seenForm } : {}),
        kind: draft.kind,
        ipa: draft.ipa,
        senses: draft.senses.map(({ id, pos, meaningEs, definitionEn, register, examples, matchesContext }) => ({
          id, pos, meaningEs, definitionEn, register, examples, matchesContext,
        })),
        ...(draft.forms ? { forms: draft.forms } : {}),
        family: draft.family,
        synonyms: draft.synonyms,
        antonyms: draft.antonyms,
        collocations: draft.collocations,
        ...(draft.learnerNote ? { learnerNote: draft.learnerNote } : {}),
        ...(draft.usNote ? { usNote: draft.usNote } : {}),
        ...(draft.cefr ? { cefr: draft.cefr } : {}),
        topicIds,
        contexts,
        status: 'active',
      },
      { now },
    )
    return 'completed'
  })
}

export interface PendingRun {
  completed: number
  merged: number
  /** Why the run stopped early (the rest of the queue waits for the next attempt). */
  failure?: AiError
}

export interface PendingDeps {
  secret: string
  /** Replaceable for tests. */
  request?: typeof requestEnrich
  now?: () => number
}

/** Entries waiting for the AI, oldest first. */
export async function listPendingEntries(): Promise<Entry[]> {
  const pending = await db.entries.where('status').equals('pending_ai').toArray()
  return pending.filter((entry) => entry.deletedAt === undefined).sort((a, b) => a.createdAt - b.createdAt)
}

/** Completes the waiting entries one by one; stops at the first failure so it is not hammered. */
export async function processPendingEntries(deps: PendingDeps): Promise<PendingRun> {
  const request = deps.request ?? requestEnrich
  const result: PendingRun = { completed: 0, merged: 0 }

  for (const waiting of await listPendingEntries()) {
    try {
      const entry = await getActive('entries', waiting.id)
      if (entry?.status !== 'pending_ai') continue
      const sourceId = entry.contexts[0]?.sourceId
      const source = sourceId ? await getActive('sources', sourceId) : undefined
      const sentence = entry.contexts[0]?.sentence

      const output = await request(
        {
          input: entry.lemma,
          ...(sentence ? { context: sentence } : {}),
          ...(source ? { sourceTitle: source.title } : {}),
          existingTopics: await loadTopicsForPrompt(),
        },
        { secret: deps.secret },
      )
      const outcome = await applyEnrichToEntry(entry, output, deps.now?.())
      if (outcome === 'merged') result.merged += 1
      else result.completed += 1
    } catch (error) {
      if (error instanceof AiError) return { ...result, failure: error }
      throw error
    }
  }
  return result
}
