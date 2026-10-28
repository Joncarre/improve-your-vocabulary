import { useEffect, useRef, useState } from 'react'
import { playAudio } from '../../../audio/useSpeech.ts'
import { isVerbAnswer, planVerbForms, type VerbLevel, type VerbQuestion, type VerbRound } from '../../../games/verbForms.ts'
import { POS_LABEL_ES } from '../../../lib/pos.ts'
import type { Entry } from '../../../shared/index.ts'
import { checkAnswer, type CheckResult } from '../../../srs/checker.ts'
import { Button } from '../../../ui/Button.tsx'
import { Chip } from '../../../ui/Chip.tsx'
import { SpeakerButton } from '../../../ui/SpeakerButton.tsx'
import { Verdict } from '../../review/ProductionCard.tsx'
import { GameShell } from '../GameShell.tsx'
import { clock, hasFinePointer } from '../dom.ts'
import { AnswerInput, NextBar, NothingToPlay, OptionButton, ResultBanner, type OptionState } from '../parts.tsx'
import type { GamePlayProps } from '../types.ts'

type Which = 'past' | 'part'

interface RoundViewProps {
  round: VerbRound
  level: VerbLevel
  autoPlayAudio: boolean
  last: boolean
  onAnswered: (correct: boolean, ms: number) => void
  onNext: () => void
}

const isRight = (result: CheckResult | null | undefined) => result?.verdict === 'exact' || result?.verdict === 'typo'

/** What the written answer was: right, almost (with the letters that differ), or the answer. */
function FieldResult({ label, question, result, typed }: { label: string; question: VerbQuestion; result: CheckResult | null; typed: string }) {
  return (
    <div>
      <p className="mb-1 text-caption text-text-3">{label}</p>
      {result && result.verdict !== 'empty' ? (
        <Verdict result={result} typed={typed} />
      ) : (
        <ResultBanner correct={false}>
          <p className="text-body font-medium">Era «{question.shown}»</p>
        </ResultBanner>
      )}
    </div>
  )
}

/** One verb: its past simple and its past participle, chosen or written. It starts afresh for every round. */
function RoundView({ round, level, autoPlayAudio, last, onAnswered, onNext }: RoundViewProps) {
  const [picked, setPicked] = useState<Partial<Record<Which, string>>>({})
  const [typed, setTyped] = useState({ past: '', part: '' })
  const [results, setResults] = useState<{ past: CheckResult | null; part: CheckResult | null } | null>(null)
  const [done, setDone] = useState(false)
  const [wasRight, setWasRight] = useState(false)
  const startedAt = useRef(0)
  const settled = useRef(false)
  const firstInput = useRef<HTMLInputElement | null>(null)
  const secondInput = useRef<HTMLInputElement | null>(null)
  const sense = round.entry.senses.find((candidate) => candidate.pos === 'phrasal_verb') ? 'phrasal_verb' : 'verb'

  useEffect(() => {
    startedAt.current = clock()
    if (level === 'type' && hasFinePointer()) firstInput.current?.focus()
  }, [level])

  const settle = (correct: boolean) => {
    if (settled.current) return
    settled.current = true
    setDone(true)
    setWasRight(correct)
    onAnswered(correct, clock() - startedAt.current)
    if (autoPlayAudio) playAudio({ key: 'game-verb', text: `${round.base}, ${round.pastSimple.shown}, ${round.pastParticiple.shown}` })
  }

  const pick = (which: Which, option: string) => {
    if (picked[which] !== undefined) return
    const next = { ...picked, [which]: option }
    setPicked(next)
    if (next.past !== undefined && next.part !== undefined) {
      settle(isVerbAnswer(round.pastSimple, next.past) && isVerbAnswer(round.pastParticiple, next.part))
    }
  }

  const check = (giveUp = false) => {
    if (done || (!giveUp && !typed.past.trim() && !typed.part.trim())) return
    const past = giveUp ? null : checkAnswer(typed.past, round.pastSimple.accepted)
    const part = giveUp ? null : checkAnswer(typed.part, round.pastParticiple.accepted)
    setResults({ past, part })
    settle(isRight(past) && isRight(part))
  }

  const stateOf = (which: Which, question: VerbQuestion, option: string): OptionState => {
    const chosen = picked[which]
    if (chosen === undefined) return 'idle'
    if (isVerbAnswer(question, option)) return 'correct'
    return option === chosen ? 'wrong' : 'dim'
  }

  const block = (which: Which, title: string, question: VerbQuestion) => (
    <section aria-label={title}>
      <h3 className="mb-1.5 text-secondary font-medium text-text-2">{title}</h3>
      <div role="group" aria-label={`Opciones de ${title}`} className="grid grid-cols-2 gap-2">
        {question.options.map((option) => (
          <OptionButton key={option} state={stateOf(which, question, option)} disabled={picked[which] !== undefined} onClick={() => pick(which, option)}>
            {option}
          </OptionButton>
        ))}
      </div>
    </section>
  )

  return (
    <>
      <div className="mx-auto min-h-0 w-full max-w-[560px] flex-1 space-y-4 overflow-y-auto px-4 pb-3">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Chip tone={sense === 'phrasal_verb' ? 'phrasal' : 'verb'}>{POS_LABEL_ES[sense]}</Chip>
            {round.irregular ? <Chip tone="hard">irregular</Chip> : null}
          </div>
          <div className="flex items-center gap-1">
            <span className="font-serif text-word-card font-medium [overflow-wrap:anywhere]">{round.base}</span>
            <SpeakerButton id="game-verb-base" text={round.base} audioUrl={round.entry.audioUrl} label={`Escuchar «${round.base}»`} />
          </div>
          {round.meaningEs ? <p className="text-body text-text-2">{round.meaningEs}</p> : null}
        </div>

        {level === 'choose' ? (
          <>
            {block('past', 'Pasado simple', round.pastSimple)}
            {block('part', 'Participio (past participle)', round.pastParticiple)}
          </>
        ) : (
          <div className="space-y-3">
            <AnswerInput value={typed.past} onChange={(value) => setTyped((state) => ({ ...state, past: value }))} onSubmit={() => secondInput.current?.focus()} label="Pasado simple (past simple)" disabled={done} inputRef={firstInput} enterKeyHint="next" />
            <AnswerInput value={typed.part} onChange={(value) => setTyped((state) => ({ ...state, part: value }))} onSubmit={() => check()} label="Participio (past participle)" disabled={done} inputRef={secondInput} />
          </div>
        )}

        {done && level === 'type' && results ? (
          <div className="space-y-2">
            <FieldResult label="Pasado simple" question={round.pastSimple} result={results.past} typed={typed.past} />
            <FieldResult label="Participio" question={round.pastParticiple} result={results.part} typed={typed.part} />
          </div>
        ) : null}
        {done && level === 'type' && !results ? (
          <ResultBanner correct={false}>
            <p className="text-body font-medium">
              {round.base} · {round.pastSimple.shown} · {round.pastParticiple.shown}
            </p>
          </ResultBanner>
        ) : null}
        {done && level === 'choose' ? (
          <ResultBanner correct={wasRight}>
            <p className="text-body font-medium">{wasRight ? '¡Correcto!' : 'Repásalo:'}</p>
            <p className="font-serif text-section text-text">
              {round.base} · {round.pastSimple.shown} · {round.pastParticiple.shown}
            </p>
          </ResultBanner>
        ) : null}
      </div>

      {done ? (
        <NextBar last={last} onNext={onNext} />
      ) : level === 'type' ? (
        <div className="mx-auto grid w-full max-w-[560px] grid-cols-2 gap-2 px-4 pt-1">
          <Button className="h-12" onClick={() => check(true)}>
            No lo sé
          </Button>
          <Button variant="primary" className="h-12" disabled={!typed.past.trim() && !typed.part.trim()} onClick={() => check()}>
            Comprobar
          </Button>
        </div>
      ) : null}
    </>
  )
}

/** Formas verbales (spec §8): past simple and past participle, the irregular verbs first. */
export default function VerbFormsGame({ words, variant, pick, autoPlayAudio, record, onFinish, onExit }: GamePlayProps) {
  const level: VerbLevel = variant === 'type' ? 'type' : 'choose'
  const [rounds] = useState(() => planVerbForms(words, { level, pick }))
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [missed, setMissed] = useState<Entry[]>([])
  const [startedAt] = useState(clock)
  const round = rounds[index]

  if (!round) {
    return (
      <GameShell label="Formas verbales" progress={0} counter="" onExit={onExit}>
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
    <GameShell label="Formas verbales" progress={index / rounds.length} counter={`${index + 1} de ${rounds.length}`} onExit={onExit}>
      <RoundView key={index} round={round} level={level} autoPlayAudio={autoPlayAudio} last={index + 1 === rounds.length} onAnswered={answered} onNext={next} />
    </GameShell>
  )
}
