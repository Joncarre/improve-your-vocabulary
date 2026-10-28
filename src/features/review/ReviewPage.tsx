import { Undo2, X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router'
import { stopAudio } from '../../audio/useSpeech.ts'
import { useDeviceSettings } from '../../db/settings.ts'
import { useVisualViewport } from '../../lib/useVisualViewport.ts'
import { IconButton } from '../../ui/Button.tsx'
import { Skeleton } from '../../ui/Skeleton.tsx'
import { CardStage } from './CardStage.tsx'
import { SessionSummary } from './SessionSummary.tsx'
import { BLOCK_SIZE, useReviewSession, type SessionMode } from './useReviewSession.ts'

/**
 * Review session (spec §7): full screen, one card at a time, blocks of 20. `/review` is the daily
 * review; `/review/series/:id` is an extra review of one series or film. It is pinned to the visual
 * viewport, so on a phone the written answer stays in sight with the keyboard open.
 */
export default function ReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const mode = useMemo<SessionMode>(() => (id ? { kind: 'extra', sourceId: id } : { kind: 'daily' }), [id])
  const extra = mode.kind === 'extra'
  const { settings } = useDeviceSettings()
  const session = useReviewSession(mode)
  const { top, height, keyboardOpen } = useVisualViewport()

  const exit = () => navigate(id ? `/source/${id}` : '/', { replace: true })

  // The keyboard handler always calls the latest undo without being set up again on every render.
  const undoRef = useRef(session.undo)
  useEffect(() => {
    undoRef.current = session.undo
  })

  useEffect(() => {
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const typing = (event.target as HTMLElement).closest('input, textarea, select')
      if (event.key === 'Escape') {
        if (!document.querySelector('[role=dialog]')) navigate(id ? `/source/${id}` : '/', { replace: true })
      } else if ((event.key === 'z' || event.key === 'Z') && !typing) {
        void undoRef.current()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [id, navigate])

  // Leaving the review silences whatever is playing.
  useEffect(() => stopAudio, [])

  const total = Math.min(BLOCK_SIZE, session.blockAnswered + session.remaining)
  const progress = total > 0 ? Math.round((session.blockAnswered / total) * 100) : 0
  const { item, model } = session

  return (
    <section aria-label={extra ? 'Repaso de la serie' : 'Repaso'} className="fixed inset-x-0 z-50 flex flex-col bg-bg" style={{ top, height }}>
      <header className="mx-auto flex w-full max-w-[600px] items-center gap-1 px-2 pt-[env(safe-area-inset-top)]">
        <IconButton label="Salir del repaso" onClick={exit}>
          <X size={22} aria-hidden="true" />
        </IconButton>
        <div className="flex-1 px-2">
          <div
            role="progressbar"
            aria-label="Progreso del bloque"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={session.blockAnswered}
            className="h-1.5 overflow-hidden rounded-full bg-surface-2"
          >
            <div className="h-full rounded-full bg-accent transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-center text-caption tabular-nums text-text-3">
            {session.phase === 'card' ? `${session.blockAnswered + 1} de ${total}` : `${session.stats.answered} repasadas`}
          </p>
        </div>
        <IconButton label="Deshacer la última valoración" disabled={!session.canUndo || session.busy} onClick={() => void session.undo()} className="disabled:opacity-30">
          <Undo2 size={20} aria-hidden="true" />
        </IconButton>
      </header>

      <div className="flex min-h-0 flex-1 flex-col pt-1" style={{ paddingBottom: keyboardOpen ? 8 : 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        {session.phase === 'loading' ? (
          <div role="status" aria-label="Cargando" className="flex-1 space-y-3 px-4 pt-4">
            <Skeleton className="h-3/4 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : session.phase === 'card' && item && model ? (
          <CardStage key={`${item.card.id}:${item.card.stats.seen}`} session={session} extra={extra} autoPlayAudio={settings.autoPlayAudio} />
        ) : (
          <SessionSummary
            phase={session.phase === 'blockEnd' ? 'blockEnd' : 'done'}
            stats={session.stats}
            remaining={session.remaining}
            extra={extra}
            onContinue={session.continueBlock}
            onExit={exit}
          />
        )}
      </div>
    </section>
  )
}
