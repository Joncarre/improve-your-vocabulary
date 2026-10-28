import type { Card, Entry, PartOfSpeech } from '../../shared/index.ts'
import type { WordState } from '../../srs/state.ts'
import { summarizeProgress } from '../entry/progress.ts'

/** An entry with the numbers the list needs, computed once per change of the collection. */
export interface LibraryRow {
  entry: Entry
  state: WordState
  /** Total wrong answers over all its cards. */
  wrong: number
  /** When the next review is due (ms); null while the word has not started. */
  nextDue: number | null
  /** The series or films where it was seen. */
  sourceIds: string[]
  /** Word type of its first sense. */
  pos: PartOfSpeech | undefined
}

export function buildRows(entries: readonly Entry[], cards: readonly Card[]): LibraryRow[] {
  const cardsByEntry = new Map<string, Card[]>()
  for (const card of cards) {
    const list = cardsByEntry.get(card.entryId)
    if (list) list.push(card)
    else cardsByEntry.set(card.entryId, [card])
  }

  return entries.map((entry) => {
    const progress = summarizeProgress(cardsByEntry.get(entry.id) ?? [])
    return {
      entry,
      state: progress.state,
      wrong: progress.wrong,
      nextDue: progress.nextDue,
      sourceIds: [...new Set(entry.contexts.flatMap((context) => (context.sourceId ? [context.sourceId] : [])))],
      pos: entry.senses[0]?.pos,
    }
  })
}
