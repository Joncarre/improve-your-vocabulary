import { Search, X } from 'lucide-react'
import type { RefObject } from 'react'
import {
  SORT_OPTIONS,
  STATUS_FILTERS,
  VIEW_OPTIONS,
  type SortKey,
  type StatusFilter,
  type ViewKey,
} from './filters.ts'

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  inputRef: RefObject<HTMLInputElement | null>
}

/** Search in English or Spanish. The "/" key focuses it (shown as a hint on desktop). */
export function SearchField({ value, onChange, inputRef }: SearchFieldProps) {
  return (
    <div className="relative mt-1">
      <Search size={16} className="pointer-events-none absolute left-3 top-3 text-text-3" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault()
            onChange('')
          }
        }}
        aria-label="Buscar palabra"
        placeholder="Buscar en inglés o en español"
        enterKeyHint="search"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        className="h-10 w-full min-w-0 appearance-none rounded-control border border-border bg-surface-2 pl-9 pr-10 text-text placeholder:text-text-3 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="Borrar búsqueda"
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
          className="absolute right-0 top-0 flex size-10 items-center justify-center text-text-3 active:text-text"
        >
          <X size={16} aria-hidden="true" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-3 top-2.5 hidden rounded-chip border border-border px-1.5 text-caption text-text-3 lg:block">
          /
        </kbd>
      )}
    </div>
  )
}

interface ControlsProps {
  view: ViewKey
  onView: (view: ViewKey) => void
  status: StatusFilter
  onStatus: (status: StatusFilter) => void
  counts: Record<StatusFilter, number>
  sort: SortKey
  onSort: (sort: SortKey) => void
  /** While searching, the best match comes first and the order selector has no effect. */
  searching: boolean
  total: number
}

/** View (all, by topic, by series, by word type), filter by state and order. */
export function LibraryControls({ view, onView, status, onStatus, counts, sort, onSort, searching, total }: ControlsProps) {
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Vista" className="grid grid-cols-4 rounded-control bg-surface-2 p-0.5">
        {VIEW_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={view === option.value}
            onClick={() => onView(option.value)}
            className={`h-9 rounded-[7px] text-secondary font-medium transition-colors ${
              view === option.value ? 'bg-surface text-text shadow-sm' : 'text-text-2'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Filtrar por estado" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 md:-mx-8 md:px-8 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
        {STATUS_FILTERS.map((option) => {
          const count = counts[option.value]
          // Empty filters add noise; the chosen one always stays so it can be turned off.
          if (count === 0 && option.value !== 'all' && option.value !== status) return null
          const active = status === option.value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onStatus(option.value)}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-chip border px-3 text-secondary transition-colors ${
                active ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface text-text-2 active:bg-surface-2'
              }`}
            >
              {option.label}
              <span className="tabular-nums text-text-3">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-3 pt-0.5">
        <p role="status" className="text-caption text-text-3">
          {total === 1 ? '1 palabra' : `${total} palabras`}
          {searching ? ' · mejores resultados primero' : ''}
        </p>
        <label className="flex items-center gap-1.5 text-caption text-text-3">
          Orden
          <select
            value={sort}
            disabled={searching}
            onChange={(event) => onSort(event.target.value as SortKey)}
            className="h-9 rounded-control border border-border bg-surface-2 px-2 text-secondary text-text disabled:opacity-40"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
