import { useRef, useState } from 'react'
import { buildBank, isGapRight, storySegments, type StoryGap } from '../../../games/story.ts'
import { markStoryPlayed } from '../../../games/storyStore.ts'
import type { Rng } from '../../../games/rng.ts'
import type { Story } from '../../../shared/index.ts'
import { Button } from '../../../ui/Button.tsx'
import { GameShell } from '../GameShell.tsx'
import { clock } from '../dom.ts'
import { ResultBanner } from '../parts.tsx'
import type { GamePlayProps } from '../types.ts'

interface StoryGapsProps extends Pick<GamePlayProps, 'record' | 'onFinish' | 'onExit'> {
  story: Story
  gaps: StoryGap[]
  rng: Rng
}

/** Next empty gap after `from`, or the first empty one, or `from` itself when all are full. */
function nextEmpty(placed: readonly (string | null)[], from: number): number {
  const after = placed.findIndex((id, index) => id === null && index > from)
  if (after !== -1) return after
  const first = placed.indexOf(null)
  return first === -1 ? from : first
}

/** The same story with its words taken out: tap a gap, then the word of the bank that belongs in it. */
export function StoryGaps({ story, gaps, rng, record, onFinish, onExit }: StoryGapsProps) {
  const [bank] = useState(() => buildBank(gaps, rng))
  const [placed, setPlaced] = useState<(string | null)[]>(() => gaps.map(() => null))
  const [active, setActive] = useState(0)
  const [checked, setChecked] = useState(false)
  const [startedAt] = useState(clock)
  const [elapsed, setElapsed] = useState(0)
  const scroller = useRef<HTMLDivElement | null>(null)

  const textOf = (index: number) => bank.find((word) => word.id === placed[index])?.text
  const right = (index: number) => {
    const gap = gaps[index]
    return gap !== undefined && isGapRight(gap, textOf(index))
  }
  const available = bank.filter((word) => !placed.includes(word.id))
  const full = placed.every((id) => id !== null)
  const score = gaps.filter((_, index) => right(index)).length

  const place = (id: string) => {
    if (checked) return
    const target = placed[active] === null ? active : placed.indexOf(null)
    if (target === -1) return
    const next = placed.map((current, index) => (index === target ? id : current))
    setPlaced(next)
    setActive(nextEmpty(next, target))
  }

  // A filled gap gives its word back to the bank.
  const pickGap = (index: number) => {
    if (checked) return
    if (placed[index] !== null) setPlaced(placed.map((current, at) => (at === index ? null : current)))
    setActive(index)
  }

  const check = () => {
    if (!full || checked) return
    const ms = clock() - startedAt
    gaps.forEach((gap, index) => record({ entryId: gap.entry.id, correct: right(index), ms: ms / gaps.length }))
    void markStoryPlayed(story.id).catch(() => undefined)
    setElapsed(ms)
    setChecked(true)
    // The result is at the top: the text is long and the person may be far down it.
    scroller.current?.scrollTo({ top: 0 })
  }

  const finish = () =>
    onFinish({
      score,
      total: gaps.length,
      durationMs: elapsed,
      missed: gaps.filter((_, index) => !right(index)).map((gap) => gap.entry),
    })

  return (
    <GameShell label="Historia" progress={checked ? 1 : placed.filter((id) => id !== null).length / gaps.length} counter={checked ? 'Resultado' : `${placed.filter((id) => id !== null).length} de ${gaps.length} huecos`} onExit={onExit}>
      <div ref={scroller} className="mx-auto min-h-0 w-full max-w-[560px] flex-1 space-y-4 overflow-y-auto px-4 pb-3">
        <h1 className="font-serif text-word-entry font-medium [overflow-wrap:anywhere]">{story.title}</h1>
        {checked ? (
          <ResultBanner correct={score === gaps.length}>
            <p className="text-body font-medium">{score === gaps.length ? '¡Todas en su sitio!' : `Has acertado ${score} de ${gaps.length}`}</p>
            {score < gaps.length ? <p className="text-secondary text-text-2">Las que fallaste salen en verde, con la palabra que iba.</p> : null}
          </ResultBanner>
        ) : (
          <p className="text-secondary text-text-2">Toca un hueco y luego la palabra que va en él. Si te equivocas, toca el hueco otra vez para quitarla.</p>
        )}

        <p lang="en" className="text-[19px] leading-[2.2] [overflow-wrap:anywhere]">
          {storySegments(story.textEn, gaps).map((segment, index) => {
            if (segment.kind === 'text') return segment.text
            const at = segment.gap.index
            const word = textOf(at)
            const tone = checked ? (right(at) ? 'border-good text-good' : 'border-again text-again') : active === at ? 'border-accent ring-2 ring-accent' : 'border-border'
            return (
              <span key={index} className="whitespace-nowrap">
                <button
                  type="button"
                  disabled={checked}
                  aria-label={`Hueco ${at + 1}${word ? `: ${word}` : ''}`}
                  onClick={() => pickGap(at)}
                  className={`mx-0.5 inline-block min-h-8 min-w-[4.5rem] rounded-control border bg-surface-2 px-2 align-baseline font-semibold ${tone}`}
                >
                  {word ?? <span className="text-text-3">···</span>}
                </button>
                {checked && !right(at) ? <span className="ml-1 font-semibold text-good">{segment.gap.answer}</span> : null}
              </span>
            )
          })}
        </p>

        {checked ? (
          <p className="rounded-card border border-border bg-surface-2 p-3 text-body text-text-2">{story.textEs}</p>
        ) : (
          <div role="group" aria-label="Palabras para colocar" className="flex flex-wrap gap-2">
            {available.map((word) => (
              <button key={word.id} type="button" onClick={() => place(word.id)} className="min-h-11 rounded-control border border-border bg-surface-2 px-4 font-serif text-[18px] active:bg-surface">
                {word.text}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-[560px] px-4 pt-1">
        {checked ? (
          <Button variant="primary" className="h-12 w-full text-[16px]" onClick={finish} autoFocus>
            Ver resultado
          </Button>
        ) : (
          <Button variant="primary" className="h-12 w-full text-[16px]" disabled={!full} onClick={check}>
            Comprobar
          </Button>
        )}
      </div>
    </GameShell>
  )
}
