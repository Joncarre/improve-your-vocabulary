import { BookOpen } from 'lucide-react'
import { Suspense, useLayoutEffect, useRef } from 'react'
import { Outlet, useMatch } from 'react-router'
import { EmptyState } from '../../ui/EmptyState.tsx'
import { PageSkeleton } from '../../ui/Skeleton.tsx'
import { LibraryList } from './LibraryList.tsx'
import { getSavedListScroll } from './scrollMemory.ts'

/**
 * Vocabulario and the entry page share this layout. On a phone one of them shows at a time (the
 * list, or the word that was opened); on desktop the list stays on the left and the word opens on
 * the right (master-detail).
 */
export default function LibraryShell() {
  const id = useMatch('/entry/:id')?.params.id
  const previousId = useRef(id)

  // Coming back from a word to the list on a phone lands where the list was.
  useLayoutEffect(() => {
    if (previousId.current && !id) window.scrollTo(0, getSavedListScroll())
    previousId.current = id
  }, [id])

  return (
    <div className="lg:grid lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] lg:gap-10">
      <section
        aria-label="Lista de vocabulario"
        className={`${id ? 'hidden lg:block' : ''} lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:overscroll-contain lg:pb-10`}
      >
        <LibraryList selectedId={id} />
      </section>
      <div className={id ? '' : 'hidden lg:block'}>
        {id ? (
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        ) : (
          <div className="pt-24">
            <EmptyState icon={BookOpen} title="Elige una palabra">
              Toca una palabra de la lista para ver su ficha completa.
            </EmptyState>
          </div>
        )}
      </div>
    </div>
  )
}
