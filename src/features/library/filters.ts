import { POS_LABEL_ES, POS_OPTIONS } from '../../lib/pos.ts'
import type { Source, Topic } from '../../shared/index.ts'
import { WORD_STATE_LABEL_ES, type WordState } from '../../srs/state.ts'
import type { LibraryRow } from './model.ts'

/* ---------- Filter by state ---------- */

export type StatusFilter = 'all' | WordState | 'leech' | 'pending' | 'archived'

export const STATUS_FILTERS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'new', label: 'Nuevas' },
  { value: 'learning', label: 'Aprendiendo' },
  { value: 'review', label: WORD_STATE_LABEL_ES.review },
  { value: 'consolidated', label: 'Consolidadas' },
  { value: 'mastered', label: 'Dominadas' },
  { value: 'leech', label: 'Rebeldes' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'archived', label: 'Archivadas' },
]

/** "Todas" is everything that has not been archived; the other filters narrow it down (archived has its own). */
export function matchesStatus(row: LibraryRow, filter: StatusFilter): boolean {
  const { status, isLeech } = row.entry
  switch (filter) {
    case 'all':
      return status !== 'archived'
    case 'leech':
      return isLeech && status !== 'archived'
    case 'pending':
      return status === 'pending_ai'
    case 'archived':
      return status === 'archived'
    default:
      return status === 'active' && row.state === filter
  }
}

export function countByStatus(rows: readonly LibraryRow[]): Record<StatusFilter, number> {
  const counts = Object.fromEntries(STATUS_FILTERS.map(({ value }) => [value, 0])) as Record<StatusFilter, number>
  for (const row of rows) {
    for (const { value } of STATUS_FILTERS) if (matchesStatus(row, value)) counts[value] += 1
  }
  return counts
}

/* ---------- Sort ---------- */

export type SortKey = 'recent' | 'alpha' | 'wrong' | 'due'

export const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: 'recent', label: 'Recientes' },
  { value: 'alpha', label: 'Alfabético' },
  { value: 'wrong', label: 'Más falladas' },
  { value: 'due', label: 'Próxima revisión' },
]

const byRecent = (a: LibraryRow, b: LibraryRow) => b.entry.createdAt - a.entry.createdAt
const byLemma = (a: LibraryRow, b: LibraryRow) => a.entry.lemmaKey.localeCompare(b.entry.lemmaKey, 'en')

/** A sorted copy: the sort is stable and every order falls back to the newest first or the alphabet. */
export function sortRows(rows: readonly LibraryRow[], key: SortKey): LibraryRow[] {
  const copy = [...rows]
  switch (key) {
    case 'alpha':
      return copy.sort(byLemma)
    case 'wrong':
      return copy.sort((a, b) => b.wrong - a.wrong || byRecent(a, b))
    case 'due':
      // Words that have started come first, the soonest due on top; the rest follow, newest first.
      return copy.sort((a, b) => {
        if (a.nextDue === null && b.nextDue === null) return byRecent(a, b)
        if (a.nextDue === null) return 1
        if (b.nextDue === null) return -1
        return a.nextDue - b.nextDue || byLemma(a, b)
      })
    default:
      return copy.sort(byRecent)
  }
}

/* ---------- Views ---------- */

export type ViewKey = 'all' | 'topic' | 'source' | 'pos'

export const VIEW_OPTIONS: ReadonlyArray<{ value: ViewKey; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'topic', label: 'Temas' },
  { value: 'source', label: 'Fuentes' },
  { value: 'pos', label: 'Tipos' },
]

export interface RowGroup {
  key: string
  title: string
  emoji?: string
  /** Page of the group, when it has one (a series or film). */
  href?: string
  rows: LibraryRow[]
}

const NO_TOPIC = 'Sin tema'
const NO_SOURCE = 'Sin fuente'
const NO_TYPE = 'Sin tipo'

/**
 * Groups the rows (already filtered and sorted; the order inside each group is kept). A word with
 * two topics shows up under both. Groups are alphabetical, with "Sin …" last.
 */
export function groupRows(
  rows: readonly LibraryRow[],
  view: ViewKey,
  context: { topics: readonly Topic[]; sources: readonly Source[] },
): RowGroup[] {
  if (view === 'all') return [{ key: 'all', title: 'Todas', rows: [...rows] }]

  const groups = new Map<string, RowGroup>()
  const add = (key: string, make: () => Omit<RowGroup, 'rows' | 'key'>, row: LibraryRow) => {
    const group = groups.get(key)
    if (group) group.rows.push(row)
    else groups.set(key, { key, ...make(), rows: [row] })
  }

  const topicById = new Map(context.topics.map((topic) => [topic.id, topic]))
  const sourceById = new Map(context.sources.map((source) => [source.id, source]))

  for (const row of rows) {
    if (view === 'topic') {
      const topics = row.entry.topicIds.flatMap((id) => topicById.get(id) ?? [])
      if (topics.length === 0) add('none', () => ({ title: NO_TOPIC }), row)
      for (const topic of topics) add(topic.id, () => ({ title: topic.nameEs, emoji: topic.emoji }), row)
    } else if (view === 'source') {
      const sources = row.sourceIds.flatMap((id) => sourceById.get(id) ?? [])
      if (sources.length === 0) add('none', () => ({ title: NO_SOURCE }), row)
      for (const source of sources) add(source.id, () => ({ title: source.title, href: `/source/${source.id}` }), row)
    } else {
      const label = row.pos ? POS_LABEL_ES[row.pos] : NO_TYPE
      add(row.pos ? label : 'none', () => ({ title: label.charAt(0).toUpperCase() + label.slice(1) }), row)
    }
  }

  const list = [...groups.values()]
  if (view === 'pos') {
    // Fixed order of word types, not alphabetical; "expresión" is both idioms and expressions.
    const order = (group: RowGroup) => {
      const index = POS_OPTIONS.findIndex((pos) => POS_LABEL_ES[pos].toLowerCase() === group.title.toLowerCase())
      return index === -1 ? POS_OPTIONS.length : index
    }
    return list.sort((a, b) => order(a) - order(b))
  }
  const isNone = (group: RowGroup) => group.key === 'none'
  return list.sort((a, b) => Number(isNone(a)) - Number(isNone(b)) || a.title.localeCompare(b.title, 'es'))
}
