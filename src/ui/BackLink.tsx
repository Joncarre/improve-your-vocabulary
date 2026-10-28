import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router'

/** "‹ Vocabulario" above a page that was opened from another one. Hidden on desktop when the list is always visible. */
export function BackLink({ to, label, className = '' }: { to: string; label: string; className?: string }) {
  return (
    <Link
      to={to}
      className={`-ml-2 inline-flex min-h-11 items-center gap-0.5 pr-3 pt-[env(safe-area-inset-top)] text-body text-accent ${className}`.trim()}
    >
      <ChevronLeft size={20} aria-hidden="true" />
      {label}
    </Link>
  )
}
