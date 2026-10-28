import { CheckCheck, Coffee } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '../../ui/Button.tsx'
import { formatDuration } from './lines.ts'
import { BLOCK_SIZE, type SessionStats } from './useReviewSession.ts'

interface SessionSummaryProps {
  /** `blockEnd`: 20 cards done and more to come. `done`: nothing left. */
  phase: 'blockEnd' | 'done'
  stats: SessionStats
  remaining: number
  extra: boolean
  onContinue: () => void
  onExit: () => void
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-surface px-3 py-2">
      <div className="text-caption text-text-3">{label}</div>
      <div className="mt-0.5 text-section font-semibold tabular-nums">{value}</div>
    </div>
  )
}

/** End of a block of 20 or of the whole session: time, accuracy, new words learnt and the words to reinforce. */
export function SessionSummary({ phase, stats, remaining, extra, onContinue, onExit }: SessionSummaryProps) {
  const nothing = stats.answered === 0
  const accuracy = stats.answered > 0 ? Math.round((stats.correct / stats.answered) * 100) : 0
  const Icon = phase === 'done' ? CheckCheck : Coffee
  const title = nothing ? 'No hay nada por repasar ahora' : phase === 'done' ? (extra ? 'Repaso terminado' : '¡Sesión terminada!') : 'Bloque terminado'

  return (
    <div className="mx-auto min-h-0 w-full max-w-[560px] flex-1 overflow-y-auto px-4 pb-4">
      <div className="flex flex-col items-center pt-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-accent">
          <Icon size={26} strokeWidth={1.75} aria-hidden="true" />
        </div>
        <h2 className="mt-3 text-title font-semibold tracking-tight">{title}</h2>
        {nothing ? <p className="mt-1 max-w-xs text-secondary text-text-2">Vuelve más tarde o añade palabras nuevas.</p> : null}
      </div>

      {nothing ? null : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Figure label="Repasadas" value={String(stats.answered)} />
            <Figure label="Aciertos" value={`${accuracy} %`} />
            <Figure label="Tiempo" value={formatDuration(stats.answerMs)} />
            {extra ? null : <Figure label="Nuevas aprendidas" value={String(stats.newLearned)} />}
          </div>

          {stats.weak.length > 0 ? (
            <section className="mt-5">
              <h3 className="mb-1.5 text-section font-semibold">Palabras a reforzar</h3>
              <ul className="flex flex-wrap gap-2">
                {stats.weak.slice(0, 12).map((entry) => (
                  <li key={entry.id}>
                    <Link
                      to={`/entry/${entry.id}`}
                      className="inline-flex min-h-11 items-center rounded-control border border-again/40 bg-again/10 px-3 font-serif text-body text-again"
                    >
                      {entry.lemma}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {phase === 'blockEnd' ? (
          <>
            <Button variant="primary" className="h-12" onClick={onContinue}>
              Seguir con {Math.min(BLOCK_SIZE, remaining)} más
            </Button>
            <Button className="h-12" onClick={onExit}>
              Terminar por hoy
            </Button>
          </>
        ) : (
          <Button variant="primary" className="h-12" onClick={onExit}>
            {extra ? 'Volver a la serie' : 'Volver a Hoy'}
          </Button>
        )}
      </div>
    </div>
  )
}
