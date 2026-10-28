import { useLiveQuery } from 'dexie-react-hooks'
import { Clapperboard, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { BackLink } from '../../ui/BackLink.tsx'
import { buttonClass } from '../../ui/classes.ts'
import { EmptyState } from '../../ui/EmptyState.tsx'
import { PageSkeleton } from '../../ui/Skeleton.tsx'
import { loadLibrary } from './data.ts'
import { EntryRow } from './EntryRow.tsx'
import { buildRows } from './model.ts'
import { entriesOfSource } from './topics.ts'

/**
 * A series or film with the words found in it (spec §9). The buttons "Repasar esta serie" and
 * "Jugar con esta serie" arrive with the review (phase 5) and the games (phase 7).
 */
export default function SourcePage() {
  const { id = '' } = useParams()
  const data = useLiveQuery(loadLibrary, [])
  const [now] = useState(() => Date.now())

  const source = data?.sources.find((candidate) => candidate.id === id)
  const rows = useMemo(() => {
    if (!data) return []
    const ids = new Set(entriesOfSource(data.entries, id).map((entry) => entry.id))
    return buildRows(
      data.entries.filter((entry) => ids.has(entry.id)),
      data.cards,
    ).sort((a, b) => b.entry.createdAt - a.entry.createdAt)
  }, [data, id])

  if (data === undefined) return <PageSkeleton />

  if (!source) {
    return (
      <>
        <BackLink to="/vocabulary" label="Vocabulario" />
        <EmptyState icon={SearchX} title="No encuentro esta serie">
          Puede que se haya borrado desde otro dispositivo.
        </EmptyState>
        <div className="mt-4 flex justify-center">
          <Link to="/vocabulary" className={buttonClass('primary')}>
            Ir al vocabulario
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <BackLink to="/vocabulary" label="Vocabulario" />
      <header className="mt-2">
        <h1 className="text-title font-semibold tracking-tight [overflow-wrap:anywhere]">{source.title}</h1>
        <p className="mt-0.5 text-secondary text-text-2">
          {rows.length === 1 ? '1 palabra apuntada aquí' : `${rows.length} palabras apuntadas aquí`}
        </p>
      </header>

      <div className="mt-4">
        {rows.length === 0 ? (
          <EmptyState icon={Clapperboard} title="Todavía no hay palabras de esta serie">
            Cuando añadas una palabra con esta fuente, aparecerá aquí.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
            {rows.map((row) => (
              <EntryRow key={row.entry.id} row={row} sort="recent" now={now} />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
