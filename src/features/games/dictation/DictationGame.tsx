import { Turtle, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { canSpeak } from '../../../audio/speech.ts'
import { playAudio } from '../../../audio/useSpeech.ts'
import { judgeDictation, planDictation, type DictationRound, type DictationVerdict } from '../../../games/dictation.ts'
import { splitHighlight } from '../../../lib/highlight.ts'
import type { Entry } from '../../../shared/index.ts'
import { Button } from '../../../ui/Button.tsx'
import { EmptyState } from '../../../ui/EmptyState.tsx'
import { SpeakerButton } from '../../../ui/SpeakerButton.tsx'
import { Diff } from '../../review/ProductionCard.tsx'
import { GameShell } from '../GameShell.tsx'
import { clock, hasFinePointer } from '../dom.ts'
import { AnswerInput, NextBar, NothingToPlay, ResultBanner } from '../parts.tsx'
import type { GamePlayProps } from '../types.ts'

/** A breath between the word and the sentence. */
const SENTENCE_PAUSE_MS = 700

const pause = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

interface RoundViewProps {
  round: DictationRound
  last: boolean
  onAnswered: (correct: boolean, ms: number) => void
  onNext: () => void
}

/** The sentence with the word in it marked, once the round is over. */
function HeardSentence({ round }: { round: DictationRound }) {
  const { sentence } = round
  if (!sentence) return null
  const parts = splitHighlight(sentence.text, sentence.target)
  return (
    <section aria-label="La frase" className="rounded-card border border-border bg-surface-2 p-3">
      <div className="flex items-start gap-1">
        <p className="min-w-0 flex-1 text-[19px] leading-snug [overflow-wrap:anywhere]">
          {parts ? (
            <>
              {parts.before}
              <mark className="bg-transparent font-semibold text-accent">{parts.match}</mark>
              {parts.after}
            </>
          ) : (
            sentence.text
          )}
        </p>
        <SpeakerButton id="game-sentence" text={sentence.text} label="Escuchar la frase" className="-mr-2 -mt-1.5 shrink-0" />
      </div>
      {sentence.translationEs ? <p className="mt-1 text-secondary text-text-2">{sentence.translationEs}</p> : null}
    </section>
  )
}

function Feedback({ verdict, typed }: { verdict: DictationVerdict; typed: string }) {
  switch (verdict.verdict) {
    case 'right':
      return <ResultBanner correct>¡Correcto!</ResultBanner>
    case 'american':
      return (
        <ResultBanner correct={false}>
          <p className="text-body font-medium">En inglés británico: {verdict.expected}</p>
          <p className="text-secondary text-text-2">Lo que has escrito es ortografía americana.</p>
        </ResultBanner>
      )
    case 'typo':
      return (
        <ResultBanner correct={false}>
          <p className="text-body font-medium">Casi, pero en un dictado cada letra cuenta</p>
          {verdict.diff ? (
            <p className="mt-0.5 text-secondary text-text">
              Tú: <Diff parts={verdict.diff.typed} tone="text-again" /> <span aria-hidden="true">→</span> <span className="sr-only">correcto: </span>
              <Diff parts={verdict.diff.expected} tone="text-good" />
            </p>
          ) : null}
        </ResultBanner>
      )
    default:
      return (
        <ResultBanner correct={false}>
          <p className="text-body font-medium">Era «{verdict.expected}»</p>
          {typed.trim() ? <p className="text-secondary text-text-2">Tú: {typed}</p> : null}
        </ResultBanner>
      )
  }
}

/** One word to write down: it is spoken, then a sentence that uses it. */
function RoundView({ round, last, onAnswered, onNext }: RoundViewProps) {
  const [typed, setTyped] = useState('')
  const [answered, setAnswered] = useState<DictationVerdict | null>(null)
  const startedAt = useRef(0)
  // Each listening has a number, so a new one (or leaving) cuts the old one short, sentence included.
  const listening = useRef(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { entry } = round

  const listen = (slow: boolean) => {
    listening.current += 1
    const mine = listening.current
    void (async () => {
      const kind = await playAudio({ key: 'game-dictation', text: round.answer, audioUrl: entry.audioUrl, slow })
      if (kind === 'none' || !round.sentence) return
      await pause(SENTENCE_PAUSE_MS)
      if (mine !== listening.current) return
      await playAudio({ key: 'game-dictation', text: round.sentence.text, slow })
    })()
  }

  useEffect(() => {
    startedAt.current = clock()
    if (hasFinePointer()) inputRef.current?.focus()
    listen(false)
    return () => {
      listening.current += 1
    }
    // The round never changes while it is on screen.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [])

  const check = (giveUp = false) => {
    if (answered || (!giveUp && !typed.trim())) return
    const verdict = judgeDictation(round, giveUp ? '' : typed)
    // A sentence that has not started yet is not played any more: the answer is in.
    listening.current += 1
    setAnswered(verdict)
    onAnswered(verdict.correct, clock() - startedAt.current)
  }

  return (
    <>
      <div className="mx-auto min-h-0 w-full max-w-[560px] flex-1 space-y-4 overflow-y-auto px-4 pb-3">
        <p className="text-secondary text-text-2">Escucha la palabra y escríbela. Después suena una frase con ella, por si te ayuda.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button className="h-14 gap-2" onClick={() => listen(false)}>
            <Volume2 size={20} strokeWidth={1.75} aria-hidden="true" />
            Repetir
          </Button>
          <Button className="h-14 gap-2" onClick={() => listen(true)}>
            <Turtle size={20} strokeWidth={1.75} aria-hidden="true" />
            Más lento
          </Button>
        </div>

        <AnswerInput value={typed} onChange={setTyped} onSubmit={() => check()} label="Escribe lo que oyes" disabled={answered !== null} inputRef={inputRef} />

        {answered ? (
          <>
            <Feedback verdict={answered} typed={typed} />
            <div className="flex items-center gap-1">
              <span className="font-serif text-word-card font-medium [overflow-wrap:anywhere]">{round.answer}</span>
              <SpeakerButton id="game-dictation-word" text={round.answer} audioUrl={entry.audioUrl} label={`Escuchar «${round.answer}»`} />
            </div>
            {entry.ipa ? <p className="ipa -mt-3 text-ipa text-text-2">{entry.ipa}</p> : null}
            <HeardSentence round={round} />
          </>
        ) : null}
      </div>

      {answered ? (
        <NextBar last={last} onNext={onNext} />
      ) : (
        <div className="mx-auto grid w-full max-w-[560px] grid-cols-2 gap-2 px-4 pt-1">
          <Button className="h-12" onClick={() => check(true)}>
            No lo sé
          </Button>
          <Button variant="primary" className="h-12" disabled={!typed.trim()} onClick={() => check()}>
            Comprobar
          </Button>
        </div>
      )}
    </>
  )
}

/** Dictado (spec §8): hear it, write it, with British spelling. */
export default function DictationGame({ words, pick, turns, record, onFinish, onExit }: GamePlayProps) {
  const [rounds] = useState(() => planDictation(words, { turns, pick }))
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [missed, setMissed] = useState<Entry[]>([])
  const [startedAt] = useState(clock)
  const round = rounds[index]

  if (!canSpeak()) {
    return (
      <GameShell label="Dictado" progress={0} counter="" onExit={onExit}>
        <div className="mx-auto w-full max-w-[560px] flex-1 px-4">
          <EmptyState
            icon={VolumeX}
            title="Este dispositivo no puede hablar"
            action={
              <Button variant="primary" onClick={onExit}>
                Volver
              </Button>
            }
          >
            El dictado necesita la voz del navegador, y este no la ofrece.
          </EmptyState>
        </div>
      </GameShell>
    )
  }

  if (!round) {
    return (
      <GameShell label="Dictado" progress={0} counter="" onExit={onExit}>
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
    <GameShell label="Dictado" progress={index / rounds.length} counter={`${index + 1} de ${rounds.length}`} onExit={onExit}>
      <RoundView key={index} round={round} last={index + 1 === rounds.length} onAnswered={answered} onNext={next} />
    </GameShell>
  )
}
