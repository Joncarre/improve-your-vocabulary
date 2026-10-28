import { db } from '../../db/db.ts'
import { getActive, listActive, writeRecord } from '../../db/repo.ts'
import { newId } from '../../lib/id.ts'
import { normalizeLemmaKey } from '../../lib/lemmaKey.ts'
import { pickTopicColor } from '../../lib/palette.ts'
import { AI_LIMITS, type Card, type Context, type Entry, type ExistingTopic, type Source, type Topic } from '../../shared/index.ts'
import { newFsrsCard } from '../../srs/newCard.ts'
import { senseHasContent, type DraftSense, type EntryDraft } from './draft.ts'

/** "Marathon mode": a word added less than this long ago proposes the same source and detail. */
const MARATHON_WINDOW_MS = 3 * 60 * 60 * 1000
const MAX_TOPICS_PER_ENTRY = 2

export interface ContextInput {
  sentence?: string | undefined
  translationEs?: string | undefined
  /** Exact fragment of the sentence that is the word (for highlighting). */
  surface?: string | undefined
  sourceTitle?: string | undefined
  detail?: string | undefined
}

export interface SaveEntryInput extends ContextInput {
  draft: EntryDraft
  /** `pending_ai` when the AI could not complete it yet. */
  status: 'active' | 'pending_ai'
  now?: number
}

export async function findActiveEntryByKey(key: string): Promise<Entry | undefined> {
  if (!key) return undefined
  const matches = await db.entries.where('lemmaKey').equals(key).toArray()
  return matches.find((entry) => entry.deletedAt === undefined)
}

/** Sources ordered by how recently they were used (for autocompletion). */
export async function listSources(): Promise<Source[]> {
  return (await listActive('sources')).sort((a, b) => b.lastUsedAt - a.lastUsedAt)
}

/** The topics the AI may choose from (at most the 50 the endpoint accepts). */
export async function loadTopicsForPrompt(): Promise<ExistingTopic[]> {
  const topics = await listActive('topics')
  return topics
    .sort((a, b) => a.nameEs.localeCompare(b.nameEs, 'es'))
    .slice(0, AI_LIMITS.topicsMax)
    .map((topic) => ({ id: topic.id, nameEs: topic.nameEs }))
}

async function findOrCreateSource(title: string, now: number): Promise<Source> {
  const clean = title.trim()
  const key = normalizeLemmaKey(clean)
  const existing = (await listActive('sources')).find((source) => normalizeLemmaKey(source.title) === key)
  if (existing) return writeRecord('sources', { ...existing, lastUsedAt: now }, { now })
  return writeRecord('sources', { id: newId(), title: clean, type: 'other', lastUsedAt: now, updatedAt: now }, { now })
}

/** Existing topics by id, plus the one the AI proposed (reusing an existing topic with the same name). */
async function resolveTopicIds(draft: EntryDraft, now: number): Promise<string[]> {
  const ids = [...draft.topicIds]
  if (draft.newTopic && ids.length < MAX_TOPICS_PER_ENTRY) {
    const topics = await listActive('topics')
    const key = normalizeLemmaKey(draft.newTopic.nameEs)
    const topic: Topic =
      topics.find((candidate) => normalizeLemmaKey(candidate.nameEs) === key) ??
      (await writeRecord(
        'topics',
        {
          id: newId(),
          nameEs: draft.newTopic.nameEs,
          emoji: draft.newTopic.emoji || '🏷️',
          color: pickTopicColor(topics.map((candidate) => candidate.color)),
          updatedAt: now,
        },
        { now },
      ))
    if (!ids.includes(topic.id)) ids.push(topic.id)
  }
  return ids.slice(0, MAX_TOPICS_PER_ENTRY)
}

function buildContext(input: ContextInput, source: Source | undefined, now: number): Context | undefined {
  const sentence = input.sentence?.trim()
  if (!sentence) return undefined
  return {
    id: newId(),
    sentence,
    ...(input.translationEs?.trim() ? { translationEs: input.translationEs.trim() } : {}),
    ...(input.surface?.trim() ? { surface: input.surface.trim() } : {}),
    ...(source ? { sourceId: source.id } : {}),
    ...(input.detail?.trim() ? { detail: input.detail.trim() } : {}),
    addedAt: now,
  }
}

function toSense(sense: DraftSense) {
  return { ...sense, meaningEs: sense.meaningEs.trim(), definitionEn: sense.definitionEn.trim() }
}

/**
 * Saves a new entry in one transaction: the entry, its source and topics if they are new, and its
 * two cards (recognition ready now, production locked until recognition leaves learning).
 */
export async function saveNewEntry(input: SaveEntryInput): Promise<Entry> {
  const now = input.now ?? Date.now()
  const { draft } = input

  return db.transaction('rw', [db.entries, db.cards, db.sources, db.topics, db.outbox], async () => {
    const source = input.sourceTitle?.trim() ? await findOrCreateSource(input.sourceTitle, now) : undefined
    const topicIds = await resolveTopicIds(draft, now)
    const context = buildContext(
      { ...input, translationEs: input.translationEs ?? draft.contextTranslationEs, surface: input.surface ?? draft.contextSurface },
      source,
      now,
    )
    const lemma = draft.lemma.trim()

    const entry: Entry = {
      id: newId(),
      lemma,
      lemmaKey: normalizeLemmaKey(lemma),
      ...(draft.seenForm ? { seenForm: draft.seenForm } : {}),
      kind: draft.kind,
      ipa: draft.ipa.trim(),
      ...(draft.audioUrl ? { audioUrl: draft.audioUrl } : {}),
      senses: draft.senses.filter(senseHasContent).map(toSense),
      ...(draft.forms ? { forms: draft.forms } : {}),
      family: draft.family,
      synonyms: draft.synonyms,
      antonyms: draft.antonyms,
      collocations: draft.collocations,
      ...(draft.learnerNote ? { learnerNote: draft.learnerNote } : {}),
      ...(draft.usNote ? { usNote: draft.usNote } : {}),
      ...(draft.cefr ? { cefr: draft.cefr } : {}),
      topicIds,
      contexts: context ? [context] : [],
      status: input.status,
      isLeech: false,
      createdAt: now,
      updatedAt: now,
    }
    await writeRecord('entries', entry, { now })

    const card = (type: Card['type']): Card => ({
      id: newId(),
      entryId: entry.id,
      type,
      fsrs: newFsrsCard(now),
      due: now,
      unlocked: type === 'recognition',
      suspended: false,
      stats: { seen: 0, correct: 0, wrong: 0, streak: 0 },
      updatedAt: now,
    })
    await writeRecord('cards', card('recognition'), { now })
    await writeRecord('cards', card('production'), { now })
    return entry
  })
}

/**
 * A sense the sentence uses that the entry does not have yet. The sense that matches the sentence
 * is "new" unless an existing sense has the same part of speech and a similar meaning.
 */
export function findNewSense(existing: Entry, draft: EntryDraft): DraftSense | undefined {
  const candidate = draft.senses.find((sense) => sense.matchesContext && senseHasContent(sense))
  if (!candidate) return undefined
  const key = normalizeLemmaKey(candidate.meaningEs)
  const known = existing.senses.some((sense) => {
    if (sense.pos !== candidate.pos) return false
    const other = normalizeLemmaKey(sense.meaningEs)
    return other === key || (key.length > 2 && (other.includes(key) || key.includes(other)))
  })
  return known ? undefined : candidate
}

export interface AddContextResult {
  entry: Entry
  contextAdded: boolean
  senseAdded: boolean
}

/**
 * "Ya la tienes": the sentence becomes one more context of the existing entry (no new cards) and,
 * when the sentence uses a sense the entry lacks, that sense is added too.
 */
export async function addContextToExisting(
  entryId: string,
  input: ContextInput & { newSense?: DraftSense | undefined },
  now = Date.now(),
): Promise<AddContextResult> {
  return db.transaction('rw', [db.entries, db.sources, db.outbox], async () => {
    const entry = await getActive('entries', entryId)
    if (!entry) throw new Error('La palabra ya no existe.')

    const sentence = input.sentence?.trim() ?? ''
    const sentenceKey = normalizeLemmaKey(sentence)
    const alreadyThere = !sentence || entry.contexts.some((context) => normalizeLemmaKey(context.sentence) === sentenceKey)
    const source = !alreadyThere && input.sourceTitle?.trim() ? await findOrCreateSource(input.sourceTitle, now) : undefined
    const context = alreadyThere ? undefined : buildContext(input, source, now)

    const senseToAdd = input.newSense && senseHasContent(input.newSense) ? { ...toSense(input.newSense), matchesContext: false } : undefined
    if (!context && !senseToAdd) return { entry, contextAdded: false, senseAdded: false }

    const updated = await writeRecord(
      'entries',
      {
        ...entry,
        contexts: context ? [...entry.contexts, context] : entry.contexts,
        senses: senseToAdd ? [...entry.senses, senseToAdd] : entry.senses,
      },
      { now },
    )
    return { entry: updated, contextAdded: Boolean(context), senseAdded: Boolean(senseToAdd) }
  })
}

export interface MarathonDefaults {
  sourceTitle: string
  detail: string
  minutesAgo: number
}

/** Source and detail of the last word added if that was less than 3 hours ago. */
export async function getMarathonDefaults(now = Date.now()): Promise<MarathonDefaults | undefined> {
  const recent = (await db.entries.orderBy('updatedAt').reverse().limit(20).toArray()).filter(
    (entry) => entry.deletedAt === undefined,
  )
  let latest: Context | undefined
  for (const entry of recent) {
    for (const context of entry.contexts) {
      if (context.sourceId && (!latest || context.addedAt > latest.addedAt)) latest = context
    }
  }
  if (!latest?.sourceId || now - latest.addedAt >= MARATHON_WINDOW_MS) return undefined
  const source = await getActive('sources', latest.sourceId)
  if (!source) return undefined
  return { sourceTitle: source.title, detail: latest.detail ?? '', minutesAgo: Math.round((now - latest.addedAt) / 60_000) }
}
