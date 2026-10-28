import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { stopAudio } from '../../audio/useSpeech.ts'
import { useVisualViewport } from '../../lib/useVisualViewport.ts'
import { IconButton } from '../../ui/Button.tsx'

interface GameShellProps {
  /** Accessible name of the screen ("Huecos"). */
  label: string
  /** 0 to 1. */
  progress: number
  /** "3 de 10". */
  counter: string
  /** Something on the right of the bar (the stopwatch of Parejas). */
  right?: ReactNode
  onExit: () => void
  children: ReactNode
}

/**
 * The frame of a game in play: full screen over the tab bar, pinned to the visual viewport (so the
 * written answer stays in sight with the keyboard open), with a way out, a progress bar and Esc to leave.
 */
export function GameShell({ label, progress, counter, right, onExit, children }: GameShellProps) {
  const { top, height, keyboardOpen } = useVisualViewport()
  const exitRef = useRef(onExit)
  useEffect(() => {
    exitRef.current = onExit
  })

  useEffect(() => {
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role=dialog]')) exitRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  // Leaving a game silences whatever is playing.
  useEffect(() => stopAudio, [])

  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100)
  return (
    <section aria-label={label} className="fixed inset-x-0 z-50 flex flex-col bg-bg" style={{ top, height }}>
      <header className="mx-auto flex w-full max-w-[600px] items-center gap-1 px-2 pt-[env(safe-area-inset-top)]">
        <IconButton label="Salir del juego" onClick={onExit}>
          <X size={22} aria-hidden="true" />
        </IconButton>
        <div className="flex-1 px-2">
          <div role="progressbar" aria-label="Progreso de la partida" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 text-center text-caption tabular-nums text-text-3">{counter}</p>
        </div>
        <div className="flex size-11 items-center justify-center text-secondary tabular-nums text-text-2">{right}</div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col pt-1" style={{ paddingBottom: keyboardOpen ? 8 : 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        {children}
      </div>
    </section>
  )
}
