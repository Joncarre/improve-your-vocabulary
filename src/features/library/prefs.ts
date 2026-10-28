import { SORT_OPTIONS, STATUS_FILTERS, VIEW_OPTIONS, type SortKey, type StatusFilter, type ViewKey } from './filters.ts'

export interface LibraryPrefs {
  view: ViewKey
  status: StatusFilter
  sort: SortKey
}

export const DEFAULT_PREFS: LibraryPrefs = { view: 'all', status: 'all', sort: 'recent' }

const STORAGE_KEY = 'vocab.library.v1'

/** The last view, filter and order, kept on this device (a convenience: the list works without it). */
export function loadPrefs(): LibraryPrefs {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (typeof stored !== 'object' || stored === null) return DEFAULT_PREFS
    const { view, status, sort } = stored as Record<string, unknown>
    return {
      view: VIEW_OPTIONS.find((option) => option.value === view)?.value ?? DEFAULT_PREFS.view,
      status: STATUS_FILTERS.find((option) => option.value === status)?.value ?? DEFAULT_PREFS.status,
      sort: SORT_OPTIONS.find((option) => option.value === sort)?.value ?? DEFAULT_PREFS.sort,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function savePrefs(prefs: LibraryPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Private mode or blocked storage: the choice just is not remembered.
  }
}
