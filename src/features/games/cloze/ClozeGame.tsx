import { useEffect, useRef, useState } from 'react'
import { playAudio } from '../../../audio/useSpeech.ts'
import { isClozeAnswer, planCloze, type ClozeLevel, type ClozeRound } from '../../../games/cloze.ts'
import type { Entry } from '../../../shared/index.ts'
import { checkAnswer, type CheckResult } from '../../../srs/checker.ts'
import { Button } from '../../../ui/Button.tsx'
import { SpeakerButton } from '../../../ui/SpeakerButton.tsx'
import { Verdict } from '../../review/ProductionCard.tsx'
import { GameShell } from '../GameShell.tsx'
import { clock, hasFinePointer, isTyping } from '../dom.ts'
import { AnswerInput, GapSentence, NextBar, NothingToPlay, OptionButton, ResultBanner, type OptionState } from '../parts.tsx'
import type { GamePlayProps } from '../types.ts'

interface Answered {
  correct: boolean
  picked?: string
  /** What the written answer was compared with (level 2). */
  result?: CheckResult
}

interface RoundViewProps {
  round: ClozeRound
  level: ClozeLevel
  autoPlayAudio: boolean
  last: boolean
  onAnswered: (correct: boolean, ms: number) => void
  onNext: () => void
}

/** One sentence with its gap: four options (level 1) or a written answer (level 2). It starts afresh for every round. */
function RoundView({ round, level, autoPlayAudio, last, onAnswered, onNext }: RoundViewProps) {
  const [answered, setAnswered] = useState<Answered | null>(null)
  const [typed, setTyped] = useState('')
  const startedAt = useRef(0)
  // The key handler below is set up once, so the guard against answering twice cannot be the state.
  const settled = useRef(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const sentence = `${round.before}${round.answer}${round.after}`

  const settle = (outcome: Answered) => {
    if (settled.current) return
    settled.current = true
    setAnswered(outcome)
    onAnswered(outcome.correct, clock() - startedAt.current)
    // Hearing the sentence is part of the feedback (inside the tap, so iOS allows it).
    if (autoPlayAudio) playAudio({ key: 'game-sentence', text: sentence })
  }

  const choose = (option: string) => settle({ correct: isClozeAnswer(round, option), picked: option })
  const check = (giveUp = false) => {
    if (!giveUp && !typed.trim()) return
    const result = giveUp ? undefined : checkAnswer(typed, round.accepted)
    settle({ correct: result?.verdict === 'exact' || result?.verdict === 'typo', ...(result ? { result } : {}) })
  }

  // Keyboard: 1-4 pick an option; in level 2 the field takes the focus on a computer.
  useEffect(() => {
    startedAt.current = clock()
    if (level === 'type' && hasFinePointer()) inputRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event) || level !== 'choose') return
      const option = round.options[Number(event.key) - 1]
      if (option !== undefined) {
        event.preventDefault()
        choose(option)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // One round per component: the options never change while it is on screen.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [])

  const optionState = (option: string): OptionState => {
    if (!answered) return 'idle'
    if (isClozeAnswer(round, option)) return 'correct'
    return option === answered.picked ? 'wrong' : 'dim'
  }

  return (
    <>
      <div className="mx-auto min-h-0 w-full max-w-[560px] flex-1 space-y-4 overflow-y-auto px-4 pb-3">
        <div>
          <p className="mb-2 text-caption font-medium uppercase tracking-wider text-text-3">{round.own ? 'Tu frase' : 'Ejemplo'}</p>
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1">
              <GapSentence
                before={round.before}
                after={round.after}
                length={round.answer.length}
                {...(answered ? { reveal: { text: round.answer, tone: answered.correct ? ('good' as const) : ('again' as const) } } : {})}
              />
              {round.translationEs ? <p className="mt-1.5 text-secondary text-text-2">{round.translationEs}</p> : null}
            </div>
            {answered ? <SpeakerButton id="game-sentence" text={sentence} label="Escuchar la frase" className="-mr-2 -mt-1 shrink-0" /> : null}
          </div>
        </div>

        {level === 'choose' ? (
          <div role="group" aria-label="Opciones" className="space-y-2">
            {round.options.map((option, index) => (
              <OptionButton key={option} shortcut={index + 1} state={optionState(option)} disabled={answered !== null} onClick={() => choose(option)}>
                {option}
              </OptionButton>
            ))}
          </div>
        ) : (
          <AnswerInput value={typed} onChange={setTyped} onSubmit={() => check()} label="Escribe la palabra que falta" disabled={answered !== null} inputRef={inputRef} />
        )}

        {answered ? <Feedback round={round} level={level} answered={answered} typed={typed} /> : null}
      </div>

      {answered ? (
        <NextBar last={last} onNext={onNext} />
      ) : level === 'type' ? (
        <div className="mx-auto grid w-full max-w-[560px] grid-cols-2 gap-2 px-4 pt-1">
          <Button className="h-12" onClick={() => check(true)}>
            No lo sé
          </Button>
          <Button variant="primary" className="h-12" disabled={!typed.trim()} onClick={() => check()}>
            Comprobar
          </Button>
        </div>
      ) : null}
    </>
  )
}

function Feedback({ round, level, answered, typed }: { round: ClozeRound; level: ClozeLevel; answered: Answered; typed: string }) {
  if (level === 'type' && answered.result) return <Verdict result={answered.result} typed={typed} />
  if (answered.correct) return <ResultBanner correct>¡Correcto!</ResultBanner>
  return (
    <ResultBanner correct={false}>
      <p className="text-body font-medium">Era «{round.answer}»</p>
      {round.options.length > 0 && answered.picked ? <p className="text-secondary text-text-2">Tú: {answered.picked}</p> : null}
    </ResultBanner>
  )
}

/** Huecos (spec §8): a sentence of yours, or an example, with the word taken out. */
export default function ClozeGame({ words, pool, turns, variant, pick, autoPlayAudio, record, onFinish, onExit }: GamePlayProps) {
  const level: ClozeLevel = variant === 'type' ? 'type' : 'choose'
  const [rounds] = useState(() => planCloze(words, { level, pool, turns, pick }))
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [missed, setMissed] = useState<Entry[]>([])
  const [startedAt] = useState(clock)
  const round = rounds[index]

  if (!round) {
    return (
      <GameShell label="Huecos" progress={0} counter="" onExit={onExit}>
        <NothingToPlay onExit={onExit} />
      </GameShell>
    )
  }

  const answered = (correct: boolean, ms: number) => {
    record({ entryId: round.entry.id, correct, ms })
    if (correct) setScore((value) => value + 1)
    else setMissed((list) => [...list, round.entry])
  }
  const next = () => {
    if (index + 1 < rounds.length) setIndex(index + 1)
    else onFinish({ score, total: rounds.length, durationMs: clock() - startedAt, missed })
  }

  return (
    <GameShell label="Huecos" progress={index / rounds.length} counter={`${index + 1} de ${rounds.length}`} onExit={onExit}>
      <RoundView key={index} round={round} level={level} autoPlayAudio={autoPlayAudio} last={index + 1 === rounds.length} onAnswered={answered} onNext={next} />
    </GameShell>
  )
}
