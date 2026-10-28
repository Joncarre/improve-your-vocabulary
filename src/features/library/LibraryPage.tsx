import { useLiveQuery } from 'dexie-react-hooks'
import { AudioLines, BookOpen } from 'lucide-react'
import { Link } from 'react-router'
import { listActive } from '../../db/repo.ts'
import { POS_LABEL_ES, posTone } from '../../lib/pos.ts'
import { Chip } from '../../ui/Chip.tsx'
import { EmptyState } from '../../ui/EmptyState.tsx'
import { ICON_BUTTON_CLASS } from '../../ui/classes.ts'
import { PageHeader } from '../../ui/PageHeader.tsx'

/**
 * Provisional list so the words added in phase 2 can be seen. Search, views, filters and the
 * full entry page arrive in phases 3 and 4.
 */
export default function LibraryPage() {
  const entries = useLiveQuery(
    async () => (await listActive('entries')).sort((a, b) => b.createdAt - a.createdAt),
    [],
  )

  return (
    <>
      <PageHeader
        title="Vocabulario"
        actions={
          <Link to="/phonetics" aria-label="Guía de pronunciación" className={ICON_BUTTON_CLASS}>
            <AudioLines size={20} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        }
      />
      {entries === undefined ? null : entries.length === 0 ? (
        <EmptyState icon={BookOpen} title="Tu vocabulario aparecerá aquí">
          Añade tu primera palabra con el botón + y la verás en esta lista.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {entries.map((entry) => {
            const first = entry.senses[0]
            return (
              <li key={entry.id}>
                <Link
                  to={`/entry/${entry.id}`}
                  className="flex min-h-[52px] items-center gap-3 px-3 py-2 active:bg-surface-2"
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
                  {entry.status === 'pending_ai' ? (
                    <Chip tone="hard">Pendiente</Chip>
                  ) : entry.status === 'archived' ? (
                    <Chip>Archivada</Chip>
                  ) : first ? (
                    <Chip tone={posTone(first.pos)}>{POS_LABEL_ES[first.pos]}</Chip>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
