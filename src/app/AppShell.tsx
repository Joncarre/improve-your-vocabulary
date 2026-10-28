import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router'
import { AddSheetProvider } from '../features/add/AddSheetProvider.tsx'
import { PageSkeleton } from '../ui/Skeleton.tsx'
import { Toaster } from '../ui/toast.tsx'
import { BottomNav } from './BottomNav.tsx'
import { Onboarding } from './Onboarding.tsx'
import { PendingRunner } from './PendingRunner.tsx'
import { ReloadPrompt } from './ReloadPrompt.tsx'
import { Sidebar } from './Sidebar.tsx'

/** Layout shared by every screen: side bar on desktop, tab bar on mobile. */
export function AppShell() {
  // The list + word layout of Vocabulario needs more room than the single column of the other screens.
  const { pathname } = useLocation()
  const wide = pathname.startsWith('/vocabulary') || pathname.startsWith('/entry/')
  return (
    <AddSheetProvider>
      <div className="min-h-dvh lg:pl-60">
        <Sidebar />
        <main
          className={`mx-auto w-full max-w-[720px] px-4 pb-[calc(49px+env(safe-area-inset-bottom)+24px)] md:px-8 lg:px-10 lg:pb-10 ${wide ? 'lg:max-w-[1120px]' : ''}`}
        >
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
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
