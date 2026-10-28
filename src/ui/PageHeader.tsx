import type { ReactNode } from 'react'

/** Compact version of the iOS large title: sticky, blurred, clear of the status bar and the notch. */
export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-3 flex items-center justify-between bg-bg/80 px-4 pb-1 pt-[calc(env(safe-area-inset-top)+8px)] backdrop-blur-xl md:-mx-8 md:px-8 lg:-mx-10 lg:px-10">
      <h1 className="text-title font-semibold tracking-tight">{title}</h1>
      <div className="-mr-2 flex items-center">{actions}</div>
    </header>
  )
}
