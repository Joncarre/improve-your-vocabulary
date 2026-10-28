import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  children: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-accent">
        <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <h2 className="mt-3 text-section font-semibold">{title}</h2>
      <p className="mt-1 max-w-xs text-secondary text-text-2">{children}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
