import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ModalSheet } from '../../ui/ModalSheet.tsx'
import { Skeleton } from '../../ui/Skeleton.tsx'
import { AddSheetContext, type AddSheetInitial } from './addSheetContext.ts'

// The sheet pulls in the AI client, the schemas and the FSRS library: load it when first opened.
const AddSheet = lazy(() => import('./AddSheet.tsx').then((module) => ({ default: module.AddSheet })))

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/** Owns the add sheet and the `N` shortcut that opens it. */
export function AddSheetProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<{ initial: AddSheetInitial; key: number } | null>(null)

  const openAdd = useCallback((initial: AddSheetInitial = {}) => {
    setOpen((current) => current ?? { initial, key: Date.now() })
  }, [])
  const close = useCallback(() => setOpen(null), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'n' || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.defaultPrevented || isTypingTarget(event.target)) return
      event.preventDefault()
      openAdd()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [openAdd])

  const api = useMemo(() => ({ openAdd }), [openAdd])

  return (
    <AddSheetContext.Provider value={api}>
      {children}
      {open ? (
        <Suspense
          fallback={
            <ModalSheet title="Añadir palabra" onClose={close}>
              <Skeleton className="h-40 w-full" />
            </ModalSheet>
          }
        >
          <AddSheet key={open.key} initial={open.initial} onClose={close} />
        </Suspense>
      ) : null}
    </AddSheetContext.Provider>
  )
}
