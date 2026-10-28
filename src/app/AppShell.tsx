import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { PageSkeleton } from '../ui/Skeleton.tsx'
import { BottomNav } from './BottomNav.tsx'
import { Onboarding } from './Onboarding.tsx'
import { ReloadPrompt } from './ReloadPrompt.tsx'
import { Sidebar } from './Sidebar.tsx'

/** Layout shared by every screen: side bar on desktop, tab bar on mobile. */
export function AppShell() {
  return (
    <div className="min-h-dvh lg:pl-60">
      <Sidebar />
      <main className="mx-auto w-full max-w-[720px] px-4 pb-[calc(49px+env(safe-area-inset-bottom)+24px)] md:px-8 lg:px-10 lg:pb-10">
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <BottomNav />
      <ReloadPrompt />
      <Onboarding />
    </div>
  )
}
