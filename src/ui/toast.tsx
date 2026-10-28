import { useSyncExternalStore } from 'react'
import { currentToast, subscribeToToasts } from './toastStore.ts'

export function Toaster() {
  const toast = useSyncExternalStore(subscribeToToasts, currentToast, () => null)
  if (!toast) return null
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(49px+env(safe-area-inset-bottom)+16px)] z-[60] mx-auto max-w-sm rounded-card border border-border bg-surface-2 px-4 py-3 text-center text-secondary shadow-lg lg:bottom-6"
    >
      {toast.message}
    </div>
  )
}
