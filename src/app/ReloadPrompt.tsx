import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '../ui/Button.tsx'

/** "Nueva versión · Actualizar": shown when a new service worker is waiting. */
export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(49px+env(safe-area-inset-bottom)+12px)] z-40 flex items-center gap-2 rounded-card border border-border bg-surface-2 p-2 pl-4 lg:inset-x-auto lg:bottom-5 lg:right-5 lg:w-80"
    >
      <span className="flex-1 text-secondary">Nueva versión</span>
      <Button variant="ghost" onClick={() => setNeedRefresh(false)}>
        Luego
      </Button>
      <Button variant="primary" onClick={() => void updateServiceWorker(true)}>
        Actualizar
      </Button>
    </div>
  )
}
