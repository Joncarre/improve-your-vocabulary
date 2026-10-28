import { useState } from 'react'
import { WORD_STATE_LABEL_ES, type WordState } from '../../srs/state.ts'
import type { Card, ReviewLog } from '../../shared/index.ts'
import { Chip, type ChipTone } from '../../ui/Chip.tsx'
import { formatDue, lastAttempts, summarizeProgress } from './progress.ts'
import { Section } from './Section.tsx'

const STATE_TONE: Record<WordState, ChipTone> = {
  new: 'other',
  learning: 'hard',
  review: 'easy',
  consolidated: 'good',
  mastered: 'accent',
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-surface px-3 py-2">
      <div className="text-caption text-text-3">{label}</div>
      <div className="mt-0.5 flex min-h-6 items-center text-body font-semibold tabular-nums">{children}</div>
    </div>
  )
}

/** State, counters, streak, next review and the last ten answers as green and red dots. */
export function ProgressSection({ cards, logs }: { cards: Card[]; logs: ReviewLog[] }) {
  const [now] = useState(() => Date.now())
  const summary = summarizeProgress(cards)
  const attempts = lastAttempts(logs)
  const hits = attempts.filter(Boolean).length

  return (
    <Section title="Progreso">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label="Estado">
          <Chip tone={STATE_TONE[summary.state]}>{WORD_STATE_LABEL_ES[summary.state]}</Chip>
        </Tile>
        <Tile label="Veces vista">{summary.seen}</Tile>
        <Tile label="Aciertos">{summary.correct}</Tile>
        <Tile label="Fallos">{summary.wrong}</Tile>
        <Tile label="% de acierto">
          {summary.accuracy === null ? '—' : `${Math.round(summary.accuracy * 100)} %`}
        </Tile>
        <Tile label="Racha actual">{summary.streak}</Tile>
        <div className="col-span-2">
          <Tile label="Próxima revisión">
            {summary.nextDue === null ? <span className="font-normal text-text-2">Todavía sin empezar</span> : formatDue(summary.nextDue, now)}
          </Tile>
        </div>
      </div>

      <div className="mt-3 rounded-card border border-border bg-surface px-3 py-2">
        <div className="text-caption text-text-3">Últimos intentos</div>
        {attempts.length === 0 ? (
          <p className="mt-1 text-secondary text-text-2">Aún no hay intentos.</p>
        ) : (
          <div
            role="img"
            aria-label={`Últimos ${attempts.length} intentos: ${hits} aciertos y ${attempts.length - hits} fallos`}
            className="mt-1.5 flex gap-1.5"
          >
            {attempts.map((correct, index) => (
              <span key={index} className={`size-2.5 rounded-full ${correct ? 'bg-good' : 'bg-again'}`} />
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}
