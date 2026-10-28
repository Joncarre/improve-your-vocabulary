export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-control bg-surface-2 motion-reduce:animate-none ${className}`.trim()}
    />
  )
}

/** Fallback shown while a lazy screen loads. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Cargando" className="space-y-3 pt-[calc(env(safe-area-inset-top)+12px)]">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}
