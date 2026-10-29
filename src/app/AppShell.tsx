import { Suspense, useRef } from 'react'
import { Outlet, useLocation } from 'react-router'
import { AddSheetProvider } from '../features/add/AddSheetProvider.tsx'
import { PageSkeleton } from '../ui/Skeleton.tsx'
import { Toaster } from '../ui/toast.tsx'
import { BottomNav } from './BottomNav.tsx'
import { Onboarding } from './Onboarding.tsx'
import { PendingRunner } from './PendingRunner.tsx'
import { ReloadPrompt } from './ReloadPrompt.tsx'
import { Sidebar } from './Sidebar.tsx'

/**
 * The screens that share a layout (Vocabulario and a word) stay on screen while moving between them, so only
 * a change of section starts the fade-in of a new one.
 */
function sectionOf(pathname: string): string {
  const first = pathname.split('/')[1] ?? ''
  return first === 'entry' ? 'vocabulary' : first
}

/** Layout shared by every screen: side bar on desktop, tab bar on mobile. */
export function AppShell() {
  // The list + word layout of Vocabulario needs more room than the single column of the other screens.
  const { pathname, key } = useLocation()
  const wide = pathname.startsWith('/vocabulary') || pathname.startsWith('/entry/')
  const main = useRef<HTMLElement | null>(null)
  return (
    <AddSheetProvider>
      <div className="min-h-dvh lg:pl-60">
        <a
          href="#contenido"
          onClick={(event) => {
            // The link only moves the focus: a hash in the address would be one more place in the history.
            event.preventDefault()
            main.current?.focus()
          }}
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-bg"
        >
          Saltar al contenido
        </a>
        <Sidebar />
        <main
          id="contenido"
          ref={main}
          tabIndex={-1}
          className={`mx-auto w-full max-w-[720px] px-4 pb-[calc(49px+env(safe-area-inset-bottom)+24px)] outline-none md:px-8 lg:px-10 lg:pb-10 ${wide ? 'lg:max-w-[1120px]' : ''}`}
        >
          {/* No fade on the very first screen (the location of a fresh page has the key "default"): it would only delay it. */}
          <div key={sectionOf(pathname)} className={key === 'default' ? undefined : 'animate-screen'}>
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
        <BottomNav />
        <ReloadPrompt />
        <Onboarding />
        <PendingRunner />
        <Toaster />
      </div>
    </AddSheetProvider>
  )
}
