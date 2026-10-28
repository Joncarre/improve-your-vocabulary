import { Link } from 'react-router'
import { POS_LABEL_ES, posTone } from '../../lib/pos.ts'
import { Chip } from '../../ui/Chip.tsx'
import { formatDue } from '../entry/progress.ts'
import type { SortKey } from './filters.ts'
import type { LibraryRow } from './model.ts'

interface EntryRowProps {
  row: LibraryRow
  selected?: boolean
  /** The current order decides which extra figure is shown under the chip. */
  sort: SortKey
  now: number
  onOpen?: () => void
}

/** One word of the list: ~52 px, the whole row is the link. */
export function EntryRow({ row, selected = false, sort, now, onOpen }: EntryRowProps) {
  const { entry } = row
  const first = entry.senses[0]
  const extra =
    sort === 'wrong' && row.wrong > 0
      ? `${row.wrong} ${row.wrong === 1 ? 'fallo' : 'fallos'}`
      : sort === 'due' && row.nextDue !== null
        ? formatDue(row.nextDue, now)
        : ''

  return (
    // Rows far from the screen are not laid out until they get near it: a thousand words stay smooth.
    <li className="[contain-intrinsic-size:auto_52px] [content-visibility:auto]">
      <Link
        to={`/entry/${entry.id}`}
        onClick={onOpen}
        aria-current={selected ? 'page' : undefined}
        className={`flex min-h-[52px] items-center gap-3 px-3 py-2 active:bg-surface-2 ${selected ? 'bg-surface-2' : ''}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-serif text-section font-medium">{entry.lemma}</span>
            {entry.ipa ? <span className="ipa shrink-0 text-caption text-text-3">{entry.ipa}</span> : null}
          </div>
          <div className="truncate text-secondary text-text-2">
            {first?.meaningEs || (entry.status === 'pending_ai' ? 'Esperando a la IA…' : '')}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {entry.status === 'pending_ai' ? (
            <Chip tone="hard">Pendiente</Chip>
          ) : entry.status === 'archived' ? (
            <Chip>Archivada</Chip>
          ) : entry.isLeech ? (
            <Chip tone="again">Rebelde</Chip>
          ) : first ? (
            <Chip tone={posTone(first.pos)}>{POS_LABEL_ES[first.pos]}</Chip>
          ) : null}
          {extra ? <span className="text-caption text-text-3">{extra}</span> : null}
        </div>
      </Link>
    </li>
  )
}
