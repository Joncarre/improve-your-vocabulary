import { useLiveQuery } from 'dexie-react-hooks'
import { AudioLines, BookOpen, SearchX, Tags } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../ui/Button.tsx'
import { ICON_BUTTON_CLASS } from '../../ui/classes.ts'
import { EmptyState } from '../../ui/EmptyState.tsx'
import { PageHeader } from '../../ui/PageHeader.tsx'
import { Skeleton } from '../../ui/Skeleton.tsx'
import { loadLibrary } from './data.ts'
import { EntryRow } from './EntryRow.tsx'
import { countByStatus, groupRows, matchesStatus, sortRows, STATUS_FILTERS, type RowGroup, type SortKey } from './filters.ts'
import { LibraryControls, SearchField } from './LibraryControls.tsx'
import { buildRows } from './model.ts'
import { rememberListScroll } from './scrollMemory.ts'
import { loadPrefs, savePrefs, type LibraryPrefs } from './prefs.ts'
import { buildSearchIndex, searchEntries } from './search.ts'
import { TopicsSheet } from './TopicsSheet.tsx'
import { topicUsage } from './topics.ts'

/** Rows drawn at first and each time the end of the list comes near: a thousand words stay instant. */
const PAGE_SIZE = 100

/** A link such as /vocabulary?estado=pending opens the list with that filter (it is not remembered). */
function withUrlStatus(prefs: LibraryPrefs): LibraryPrefs {
  const wanted = new URLSearchParams(window.location.search).get('estado')
  const status = STATUS_FILTERS.find((option) => option.value === wanted)?.value
  return status ? { ...prefs, status } : prefs
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
}

function ListSkeleton() {
  return (
    <div role="status" aria-label="Cargando" className="space-y-px overflow-hidden rounded-card border border-border bg-surface">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="flex min-h-[52px] items-center gap-3 px-3 py-2">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-5 w-14" />
        </div>
      ))}
    </div>
  )
}

/** The list of words: search, views, filters by state and order (spec §9). */
export function LibraryList({ selectedId }: { selectedId?: string | undefined }) {
  const data = useLiveQuery(loadLibrary, [])
  const [prefs, setPrefs] = useState<LibraryPrefs>(() => withUrlStatus(loadPrefs()))
  const [query, setQuery] = useState('')
  const [topicsOpen, setTopicsOpen] = useState(false)
  const [now] = useState(() => Date.now())
  const searchRef = useRef<HTMLInputElement | null>(null)
  // The list stays responsive while typing: the results follow a moment later.
  const deferredQuery = useDeferredValue(query)

  const update = (patch: Partial<LibraryPrefs>) =>
    setPrefs((current) => {
      const next = { ...current, ...patch }
      savePrefs(next)
      return next
    })

  // "/" jumps to the search field, as in most web apps.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      if (isTyping(event.target) || document.querySelector('[role=dialog]')) return
      event.preventDefault()
      searchRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const topics = data?.topics
  const sources = data?.sources
  const rows = useMemo(() => (data ? buildRows(data.entries, data.cards) : []), [data])
  const index = useMemo(
    () => (data ? buildSearchIndex(data.entries, { topics: data.topics, sources: data.sources }) : null),
    [data],
  )
  const usage = useMemo(() => topicUsage(data?.entries ?? []), [data])

  const matches = useMemo(() => (index ? searchEntries(index, deferredQuery) : null), [index, deferredQuery])
  const searched = useMemo(() => (matches ? rows.filter((row) => matches.has(row.entry.id)) : rows), [rows, matches])
  const counts = useMemo(() => countByStatus(searched), [searched])
  const visible = useMemo(() => {
    const filtered = searched.filter((row) => matchesStatus(row, prefs.status))
    if (!matches) return sortRows(filtered, prefs.sort)
    // While searching, the best match comes first.
    return filtered.sort(
      (a, b) =>
        (matches.get(b.entry.id) ?? 0) - (matches.get(a.entry.id) ?? 0) || a.entry.lemmaKey.localeCompare(b.entry.lemmaKey, 'en'),
    )
  }, [searched, matches, prefs.status, prefs.sort])
  const groups = useMemo(
    () => groupRows(visible, prefs.view, { topics: topics ?? [], sources: sources ?? [] }),
    [visible, prefs.view, topics, sources],
  )

  const searching = deferredQuery.trim().length > 0

  // Only the first rows are drawn; more follow as the end gets near. Anything that changes what is
  // listed starts again from the top (the signature changes, so the old limit no longer applies).
  const signature = [deferredQuery, prefs.status, prefs.view, prefs.sort].join('|')
  const [paging, setPaging] = useState({ signature: '', limit: PAGE_SIZE })
  const limit = paging.signature === signature ? paging.limit : PAGE_SIZE
  const total = visible.length
  const showMore = () => setPaging({ signature, limit: limit + PAGE_SIZE })
  const moreRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const target = moreRef.current
    if (!target || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setPaging({ signature, limit: limit + PAGE_SIZE })
      },
      { rootMargin: '800px 0px' },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [limit, total, signature])

  const shownGroups = useMemo(() => {
    const shown: RowGroup[] = []
    let remaining = limit
    for (const group of groups) {
      if (remaining <= 0) break
      const rows = group.rows.slice(0, remaining)
      remaining -= rows.length
      shown.push({ ...group, rows })
    }
    return shown
  }, [groups, limit])
  const sortForRows: SortKey = searching ? 'recent' : prefs.sort
  const statusLabel = STATUS_FILTERS.find((option) => option.value === prefs.status)?.label.toLowerCase() ?? ''

  return (
    <>
      <PageHeader
        title="Vocabulario"
        flush
        actions={
          <>
            <button type="button" aria-label="Gestionar temas" onClick={() => setTopicsOpen(true)} className={ICON_BUTTON_CLASS}>
              <Tags size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <Link to="/phonetics" aria-label="Guía de pronunciación" className={ICON_BUTTON_CLASS}>
              <AudioLines size={20} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </>
        }
      >
        <SearchField value={query} onChange={setQuery} inputRef={searchRef} />
      </PageHeader>

      {data === undefined ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState icon={BookOpen} title="Tu vocabulario aparecerá aquí">
          Añade tu primera palabra con el botón + y la verás en esta lista.
        </EmptyState>
      ) : (
        <>
          <LibraryControls
            view={prefs.view}
            onView={(view) => update({ view })}
            status={prefs.status}
            onStatus={(status) => update({ status })}
            counts={counts}
            sort={prefs.sort}
            onSort={(sort) => update({ sort })}
            searching={searching}
            total={visible.length}
          />

          {visible.length === 0 ? (
            searching ? (
              <EmptyState
                icon={SearchX}
                title={`Sin resultados para «${deferredQuery.trim()}»`}
                action={<Button onClick={() => setQuery('')}>Borrar búsqueda</Button>}
              >
                Prueba con otra palabra, con su significado en español o con menos letras.
              </EmptyState>
            ) : (
              <EmptyState
                icon={BookOpen}
                title={`No hay palabras ${prefs.status === 'all' ? '' : `en «${statusLabel}»`}`.trim()}
                action={prefs.status === 'all' ? undefined : <Button onClick={() => update({ status: 'all' })}>Ver todas</Button>}
              >
                {prefs.status === 'all' ? 'Todas tus palabras están archivadas.' : 'Cuando haya alguna, aparecerá aquí.'}
              </EmptyState>
            )
          ) : (
            <div className="mt-3 space-y-4">
              {shownGroups.map((group) => (
                <section key={group.key} aria-label={prefs.view === 'all' ? undefined : group.title}>
                    {prefs.view === 'all' ? null : (
                      <h2 className="mb-1.5 flex items-center gap-2 px-1 text-secondary font-medium text-text-2">
                        {group.emoji ? <span aria-hidden="true">{group.emoji}</span> : null}
                        {group.href ? (
                          <Link to={group.href} className="text-accent">
                            {group.title}
                          </Link>
                        ) : (
                          group.title
                        )}
                        <span className="text-text-3">{groups.find((full) => full.key === group.key)?.rows.length ?? group.rows.length}</span>
                      </h2>
                    )}
                    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
                      {group.rows.map((row) => (
                        <EntryRow
                          key={row.entry.id}
                          row={row}
                          selected={row.entry.id === selectedId}
                          sort={sortForRows}
                          now={now}
                          onOpen={rememberListScroll}
                        />
                      ))}
                    </ul>
                </section>
              ))}
              {limit < total ? (
                <button
                  ref={moreRef}
                  type="button"
                  onClick={showMore}
                  className="mx-auto block h-11 px-4 text-secondary text-accent"
                >
                  Mostrar más ({total - limit} restantes)
                </button>
              ) : null}
            </div>
          )}
        </>
      )}

      {topicsOpen ? <TopicsSheet topics={topics ?? []} usage={usage} onClose={() => setTopicsOpen(false)} /> : null}
    </>
  )
}
