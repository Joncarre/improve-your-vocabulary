import { CheckCheck, Trophy } from 'lucide-react'
import { Link } from 'react-router'
import type { GameInfo } from '../../games/registry.ts'
import type { GameResult } from '../../shared/index.ts'
import { Button } from '../../ui/Button.tsx'
import { formatDuration } from '../review/lines.ts'
import { formatClock } from './format.ts'
import type { GameOutcome } from './types.ts'

interface GameSummaryProps {
  info: GameInfo
  /** The name of the version played ("Nivel 2"), when the game has them. */
  variantLabel: string | undefined
  outcome: GameOutcome
  /** The record before this game, if there was one. */
  previous: GameResult | undefined
  isRecord: boolean
  onAgain: () => void
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

/** How a result reads: Parejas is a time; the others are right answers out of the total. */
function describeResult(game: GameInfo['id'], result: Pick<GameResult, 'score' | 'total' | 'durationMs'>): string {
  return game === 'match' ? formatClock(result.durationMs) : `${result.score} de ${result.total} en ${formatDuration(result.durationMs)}`
}

/** End of a game: the figures, the personal record and the words to reinforce. */
export function GameSummary({ info, variantLabel, outcome, previous, isRecord, onAgain, onExit }: GameSummaryProps) {
  const { score, total, durationMs, missed } = outcome
  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0
  const race = info.id === 'match'
  const Icon = isRecord && previous ? Trophy : CheckCheck

  return (
    <div className="mx-auto w-full max-w-[560px] pb-4">
      <div className="flex flex-col items-center pt-6 text-center">
        <div className={`flex size-14 items-center justify-center rounded-full bg-surface-2 ${isRecord && previous ? 'text-hard' : 'text-accent'}`}>
          <Icon size={26} strokeWidth={1.75} aria-hidden="true" />
        </div>
        <h1 className="mt-3 text-title font-semibold tracking-tight">{isRecord && previous ? '¡Nuevo récord!' : '¡Partida terminada!'}</h1>
        <p className="mt-1 text-secondary text-text-2">
          {info.name}
          {variantLabel ? ` · ${variantLabel}` : ''}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {race ? <Figure label="Tiempo" value={formatClock(durationMs)} /> : <Figure label="Aciertos" value={`${score} de ${total}`} />}
        {race ? <Figure label="Sin fallar" value={`${score} de ${total}`} /> : <Figure label="Porcentaje" value={`${accuracy} %`} />}
        {race ? null : <Figure label="Tiempo" value={formatDuration(durationMs)} />}
      </div>

      <p className="mt-3 rounded-card border border-border bg-surface px-3 py-2 text-secondary text-text-2">
        {previous
          ? isRecord
            ? `Tu récord anterior era ${describeResult(info.id, previous)}.`
            : `Tu récord es ${describeResult(info.id, previous)}.`
          : 'Es tu primera partida con esta versión: este es tu récord.'}
      </p>

      {missed.length > 0 ? (
        <section className="mt-5">
          <h2 className="mb-1.5 text-section font-semibold">Palabras a reforzar</h2>
          <ul className="flex flex-wrap gap-2">
            {missed.slice(0, 12).map((entry) => (
              <li key={entry.id}>
                <Link to={`/entry/${entry.id}`} className="inline-flex min-h-11 items-center rounded-control border border-again/40 bg-again/10 px-3 font-serif text-body text-again">
                  {entry.lemma}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-caption text-text-3">Las que tenías para más adelante pasan al repaso de hoy.</p>
        </section>
      ) : null}

      <div className="mt-6 flex flex-col gap-2">
        <Button variant="primary" className="h-12" onClick={onAgain}>
          Jugar otra vez
        </Button>
        <Button className="h-12" onClick={onExit}>
          Volver a Juegos
        </Button>
      </div>
    </div>
  )
}
