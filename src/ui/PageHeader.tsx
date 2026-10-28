import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  actions?: ReactNode
  /** Extra rows that stay with the title when scrolling (the search field). */
  children?: ReactNode
  /** Do not bleed into the page padding on desktop: for a header inside a column of its own. */
  flush?: boolean
}

/** Compact version of the iOS large title: sticky, blurred, clear of the status bar and the notch. */
export function PageHeader({ title, actions, children, flush = false }: PageHeaderProps) {
  return (
    <header
      className={`sticky top-0 z-20 -mx-4 mb-3 bg-bg/80 px-4 pb-1 pt-[calc(env(safe-area-inset-top)+8px)] backdrop-blur-xl md:-mx-8 md:px-8 ${
        flush ? 'lg:mx-0 lg:px-0' : 'lg:-mx-10 lg:px-10'
      }`}
    >
      <div className="flex items-center justify-between">
        <h1 className="text-title font-semibold tracking-tight">{title}</h1>
        <div className="-mr-2 flex items-center">{actions}</div>
      </div>
      {children}
    </header>
  )
}
