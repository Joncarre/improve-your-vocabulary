import { AiError, callAi } from '../../ai/client.ts'
import { db } from '../../db/db.ts'
import { getActive, listActive, softDeleteRecord, writeRecord } from '../../db/repo.ts'
import { normalizeLemmaKey } from '../../lib/lemmaKey.ts'
import { EntrySchema, type Entry, type ExamplesOnlyOutput } from '../../shared/index.ts'
import { newFsrsCard } from '../../srs/newCard.ts'

const MAX_EXAMPLES = 2
/** `examples_only` accepts at most four senses. */
const MAX_REGENERATED_SENSES = 4

/** Archive an entry (it stops appearing in reviews and games) or bring it back. */
export async function setArchived(entryId: string, archived: boolean, now = Date.now()): Promise<Entry | undefined> {
  const entry = await getActive('entries', entryId)
  if (!entry) return undefined
  // An archived entry that had been waiting for the AI is no longer waiting: it comes back as active.
  return writeRecord('entries', { ...entry, status: archived ? 'archived' : 'active' }, { now })
}

/**
 * Starts the word over: both cards go back to new (production locked again), the counters and the
 * "rebelde" mark are cleared and the history of its answers is deleted.
 */
export async function resetProgress(entryId: string, now = Date.now()): Promise<void> {
  await db.transaction('rw', [db.entries, db.cards, db.logs, db.outbox], async () => {
    const entry = await getActive('entries', entryId)
    if (!entry) return

    for (const card of await db.cards.where('entryId').equals(entryId).toArray()) {
      if (card.deletedAt !== undefined) continue
      await writeRecord(
        'cards',
        {
          ...card,
          fsrs: newFsrsCard(now),
          due: now,
          unlocked: card.type === 'recognition',
          suspended: false,
          stats: { seen: 0, correct: 0, wrong: 0, streak: 0 },
        },
        { now },
      )
    }
    for (const log of await db.logs.where('entryId').equals(entryId).toArray()) {
      if (log.deletedAt === undefined) await softDeleteRecord('logs', log.id, { now })
    }
    if (entry.isLeech) await writeRecord('entries', { ...entry, isLeech: false }, { now })
  })
}

/** Logical deletion of the entry and its cards; the answers already logged stay as history. */
export async function deleteEntry(entryId: string, now = Date.now()): Promise<void> {
  await db.transaction('rw', [db.entries, db.cards, db.outbox], async () => {
    await softDeleteRecord('entries', entryId, { now })
    for (const card of await db.cards.where('entryId').equals(entryId).toArray()) {
      if (card.deletedAt === undefined) await softDeleteRecord('cards', card.id, { now })
    }
  })
}

export type SaveEditsResult =
  | { ok: true; entry: Entry }
  | { ok: false; reason: 'duplicate' | 'invalid'; message: string }

/** Saves an edited entry, refusing a word that another entry already has and anything that is not a valid entry. */
export async function saveEntryEdits(edited: Entry, now = Date.now()): Promise<SaveEditsResult> {
  const lemma = edited.lemma.trim()
  const lemmaKey = normalizeLemmaKey(lemma)
  if (!lemmaKey) return { ok: false, reason: 'invalid', message: 'La palabra no puede estar vacía.' }

  const clash = (await listActive('entries')).find((other) => other.id !== edited.id && other.lemmaKey === lemmaKey)
  if (clash) return { ok: false, reason: 'duplicate', message: `Ya tienes otra ficha con «${clash.lemma}».` }

  const candidate: Entry = { ...edited, lemma, lemmaKey }
  if (!EntrySchema.safeParse(candidate).success) {
    return { ok: false, reason: 'invalid', message: 'Hay algún campo con un valor no válido.' }
  }
  return { ok: true, entry: await writeRecord('entries', candidate, { now }) }
}

/** Puts the model's new examples into the senses they were written for (same order). */
export function applyRegeneratedExamples(entry: Entry, output: ExamplesOnlyOutput): Entry {
  return {
    ...entry,
    senses: entry.senses.map((sense, index) => {
      const examples = (output.senses[index]?.examples ?? [])
        .map((example) => ({ en: example.en.trim(), es: example.es.trim(), target: example.target.trim() }))
        .filter((example) => example.en)
        .slice(0, MAX_EXAMPLES)
        .map(({ en, es, target }) => ({ en, es, ...(target ? { target } : {}) }))
      return examples.length > 0 ? { ...sense, examples } : sense
    }),
  }
}

/** Asks the AI for fresh examples for the entry's senses and stores them. */
export async function regenerateExamples(
  entryId: string,
  options: { secret: string; request?: typeof callAi },
): Promise<Entry> {
  const entry = await getActive('entries', entryId)
  if (!entry) throw new Error('La palabra ya no existe.')
  const senses = entry.senses.slice(0, MAX_REGENERATED_SENSES)
  if (senses.length === 0) throw new AiError('bad_request', 'Esta ficha todavía no tiene acepciones.')

  const request = options.request ?? callAi
  const response = await request(
    {
      input: entry.lemma,
      mode: 'examples_only',
      senses: senses.map((sense) => ({ pos: sense.pos, meaningEs: sense.meaningEs.slice(0, 200) })),
    },
    { secret: options.secret },
  )
  if (response.mode !== 'examples_only') throw new AiError('invalid_output', 'La respuesta de la IA no es válida.')

  const latest = (await getActive('entries', entryId)) ?? entry
  return writeRecord('entries', applyRegeneratedExamples(latest, response.data))
}
