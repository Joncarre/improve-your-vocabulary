import { AiError, requestEnrich } from '../../ai/client.ts'
import { normalizeLemmaKey } from '../../lib/lemmaKey.ts'
import { AI_LIMITS } from '../../shared/index.ts'
import { buildDraftFromAi, buildDraftFromDictionary } from './draft.ts'
import {
  addContextToExisting,
  findActiveEntryByKey,
  findNewSense,
  loadTopicsForPrompt,
  saveNewEntry,
} from './save.ts'

export interface BatchItem {
  word: string
  sentence?: string
}

/**
 * One line per word, optionally "word — sentence" (an em or en dash, or a spaced hyphen, so
 * hyphenated words like "well-known" stay whole). Repeated lines are dropped.
 */
export function parseBatchList(text: string): BatchItem[] {
  const seen = new Set<string>()
  const items: BatchItem[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const match = line.match(/^(.+?)(?:\s*[—–]\s*|\s+-\s+)(.+)$/)
    const word = (match?.[1] ?? line).trim().slice(0, AI_LIMITS.wordMax)
    const sentence = match?.[2]?.trim().slice(0, AI_LIMITS.sentenceMax)
    const key = `${normalizeLemmaKey(word)}|${normalizeLemmaKey(sentence ?? '')}`
    if (!word || seen.has(key)) continue
    seen.add(key)
    items.push(sentence ? { word, sentence } : { word })
  }
  return items
}

/** Runs `worker` over the items with at most `concurrency` in flight (the batch uses 2). */
export async function runQueue<T>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<void>,
  concurrency = 2,
): Promise<void> {
  let next = 0
  const lane = async () => {
    while (next < items.length) {
      const index = next
      next += 1
      const item = items[index] as T
      await worker(item, index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane))
}

export interface BatchContext {
  secret: string
  sourceTitle?: string
  detail?: string
  /** Replaceable for tests. */
  request?: typeof requestEnrich
}

export interface BatchOutcome {
  status: 'saved' | 'duplicate' | 'pending' | 'failed'
  lemma?: string
  message?: string
}

/**
 * Processes one line of a pasted list without any preview: duplicates get the sentence as a new
 * context, errors that can be retried leave the entry as `pending_ai`, the rest is reported.
 */
export async function processBatchItem(item: BatchItem, context: BatchContext): Promise<BatchOutcome> {
  const request = context.request ?? requestEnrich
  const contextInput = { sentence: item.sentence, sourceTitle: context.sourceTitle, detail: context.detail }

  const typedMatch = await findActiveEntryByKey(normalizeLemmaKey(item.word))
  if (typedMatch) {
    const added = await addContextToExisting(typedMatch.id, contextInput)
    return {
      status: 'duplicate',
      lemma: typedMatch.lemma,
      message: added.contextAdded ? 'Ya la tenías: frase añadida' : 'Ya la tenías',
    }
  }

  try {
    const output = await request(
      {
        input: item.word,
        ...(item.sentence ? { context: item.sentence } : {}),
        ...(context.sourceTitle ? { sourceTitle: context.sourceTitle } : {}),
        existingTopics: await loadTopicsForPrompt(),
      },
      { secret: context.secret },
    )
    const draft = buildDraftFromAi(output, item.word)

    const lemmaMatch = await findActiveEntryByKey(normalizeLemmaKey(draft.lemma))
    if (lemmaMatch) {
      const added = await addContextToExisting(lemmaMatch.id, {
        ...contextInput,
        translationEs: draft.contextTranslationEs,
        surface: draft.contextSurface,
        newSense: findNewSense(lemmaMatch, draft),
      })
      return {
        status: 'duplicate',
        lemma: lemmaMatch.lemma,
        message: added.contextAdded || added.senseAdded ? 'Ya la tenías: añadido' : 'Ya la tenías',
      }
    }

    await saveNewEntry({ ...contextInput, draft, status: 'active' })
    return { status: 'saved', lemma: draft.lemma }
  } catch (error) {
    if (!(error instanceof AiError)) throw error
    if (!error.retryable) return { status: 'failed', message: error.message }
    // Temporary problem: keep what was typed and let the AI complete it later.
    await saveNewEntry({ ...contextInput, draft: buildDraftFromDictionary(item.word, null), status: 'pending_ai' })
    return { status: 'pending', lemma: item.word, message: 'Guardada; se completará sola' }
  }
}
