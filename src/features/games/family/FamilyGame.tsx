import { useEffect, useRef, useState } from 'react'
import { playAudio } from '../../../audio/useSpeech.ts'
import { isFamilyAnswer, planFamily, type FamilyMode, type FamilyRound, type SentenceRound, type SlotsRound } from '../../../games/family.ts'
import { mainSense } from '../../../games/words.ts'
import { POS_LABEL_ES, posTone } from '../../../lib/pos.ts'
import type { Entry } from '../../../shared/index.ts'
import { checkAnswer, normalizeAnswer, type CheckResult } from '../../../srs/checker.ts'
import { Button } from '../../../ui/Button.tsx'
import { Chip } from '../../../ui/Chip.tsx'
import { SpeakerButton } from '../../../ui/SpeakerButton.tsx'
import { Verdict } from '../../review/ProductionCard.tsx'
import { GameShell } from '../GameShell.tsx'
import { clock, hasFinePointer } from '../dom.ts'
import { AnswerInput, GapSentence, NextBar, NothingToPlay, ResultBanner } from '../parts.tsx'
import type { GamePlayProps } from '../types.ts'

interface RoundViewProps<R> {
  round: R
  autoPlayAudio: boolean
  last: boolean
  onAnswered: (correct: boolean, ms: number) => void
  onNext: () => void
}

/** The given word at the top of a round: type, word, how it sounds and what it means. */
function GivenWord({ entry, pos }: { entry: Entry; pos: SlotsRound['ownPos'] }) {
  return (
    <div>
      <div className="mb-1">
        <Chip tone={posTone(pos)}>{POS_LABEL_ES[pos]}</Chip>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-serif text-word-card font-medium [overflow-wrap:anywhere]">{entry.lemma}</span>
        <SpeakerButton id="game-family-word" text={entry.lemma} audioUrl={entry.audioUrl} label={`Escuchar «${entry.lemma}»`} />
      </div>
      {entry.ipa ? <p className="ipa text-ipa text-text-2">{entry.ipa}</p> : null}
    </div>
  )
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** Tap a box, then a word: each word of the family goes in the box of its type. */
function SlotsView({ round, autoPlayAudio, last, onAnswered, onNext }: RoundViewProps<SlotsRound>) {
  const [placed, setPlaced] = useState<(string | null)[]>(() => round.slots.map(() => null))
  const [active, setActive] = useState(0)
  const [checked, setChecked] = useState(false)
  const [startedAt] = useState(clock)
  const available = round.tiles.filter((tile) => !placed.includes(tile))
  const full = placed.every((tile) => tile !== null)
  const sense = mainSense(round.entry)

  const place = (tile: string) => {
    if (checked) return
    const target = placed[active] === null ? active : placed.indexOf(null)
    if (target === -1) return
    const next = placed.map((current, index) => (index === target ? tile : current))
    setPlaced(next)
    const following = next.findIndex((current, index) => current === null && index > target)
    setActive(following === -1 ? Math.max(0, next.indexOf(null)) : following)
  }

  const pickBox = (index: number) => {
    if (checked) return
    // A filled box gives its word back.
    if (placed[index] !== null) setPlaced(placed.map((current, at) => (at === index ? null : current)))
    setActive(index)
  }

  const check = () => {
    if (!full || checked) return
    const correct = round.slots.every((slot, index) => normalizeAnswer(placed[index] ?? '') === normalizeAnswer(slot.answer))
    setChecked(true)
    onAnswered(correct, clock() - startedAt)
    if (autoPlayAudio) playAudio({ key: 'game-family', text: [round.entry.lemma, ...round.slots.map((slot) => slot.answer)].join(', ') })
  }

  const rightAt = (index: number) => normalizeAnswer(placed[index] ?? '') === normalizeAnswer(round.slots[index]?.answer ?? '')

  return (
    <>
      <div className="mx-auto min-h-0 w-full max-w-[560px] flex-1 space-y-4 overflow-y-auto px-4 pb-3">
        <GivenWord entry={round.entry} pos={round.ownPos} />
        {sense?.meaningEs ? <p className="-mt-2 text-body text-text-2">{sense.meaningEs}</p> : null}
        <p className="text-secondary text-text-2">Toca una casilla y luego la palabra de la misma familia que va en ella.</p>

        <ul className="space-y-2" aria-label="Casillas">
          {round.slots.map((slot, index) => {
            const tone = !checked ? (active === index ? 'border-accent ring-2 ring-accent' : 'border-border') : rightAt(index) ? 'border-good bg-good/10' : 'border-again bg-again/10'
            return (
              <li key={slot.pos}>
                <button type="button" disabled={checked} onClick={() => pickBox(index)} className={`flex min-h-12 w-full items-center gap-3 rounded-card border bg-surface px-3 py-2 text-left ${tone}`}>
                  <span className="w-24 shrink-0 text-secondary text-text-2">{capitalise(POS_LABEL_ES[slot.pos])}</span>
                  <span className="min-w-0 flex-1 font-serif text-[19px] [overflow-wrap:anywhere]">
                    {placed[index] ?? <span className="text-text-3">···</span>}
                    {checked && !rightAt(index) ? <span className="ml-2 font-sans text-secondary text-good">→ {slot.answer}</span> : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {checked ? (
          <ResultBanner correct={round.slots.every((_, index) => rightAt(index))}>
            <p className="text-body font-medium">{round.slots.every((_, index) => rightAt(index)) ? '¡Toda la familia en su sitio!' : 'Esta es la familia:'}</p>
            <p className="font-serif text-section text-text">{[round.entry.lemma, ...round.slots.map((slot) => slot.answer)].join(' · ')}</p>
          </ResultBanner>
        ) : (
          <div role="group" aria-label="Palabras para colocar" className="flex flex-wrap gap-2">
            {available.map((tile) => (
              <button key={tile} type="button" onClick={() => place(tile)} className="min-h-11 rounded-control border border-border bg-surface-2 px-4 font-serif text-[18px] active:bg-surface">
                {tile}
              </button>
            ))}
          </div>
        )}
      </div>

      {checked ? (
        <NextBar last={last} onNext={onNext} />
      ) : (
        <div className="mx-auto w-full max-w-[560px] px-4 pt-1">
          <Button variant="primary" className="h-12 w-full text-[16px]" disabled={!full} onClick={check}>
            Comprobar
          </Button>
        </div>
      )}
    </>
  )
}

/** A sentence with a gap for the family member that fits, written. */
function SentenceView({ round, autoPlayAudio, last, onAnswered, onNext }: RoundViewProps<SentenceRound>) {
  const [typed, setTyped] = useState('')
  const [answered, setAnswered] = useState<{ correct: boolean; result?: CheckResult } | null>(null)
  const [startedAt] = useState(clock)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const sentence = `${round.before}${round.answer}${round.after}`

  useEffect(() => {
    if (hasFinePointer()) inputRef.current?.focus()
  }, [])

  const check = (giveUp = false) => {
    if (answered || (!giveUp && !typed.trim())) return
    const result = giveUp ? undefined : checkAnswer(typed, round.accepted)
    const correct = isFamilyAnswer(round, typed) || result?.verdict === 'typo'
    setAnswered({ correct, ...(result ? { result } : {}) })
    onAnswered(correct, clock() - startedAt)
    if (autoPlayAudio) playAudio({ key: 'game-sentence', text: sentence })
  }

  return (
    <>
      <div className="mx-auto min-h-0 w-full max-w-[560px] flex-1 space-y-4 overflow-y-auto px-4 pb-3">
        <div className="flex items-center gap-2">
          <Chip tone={posTone(round.pos)}>{POS_LABEL_ES[round.pos]}</Chip>
          <span className="text-secondary text-text-2">de la familia de «{round.entry.lemma}»</span>
        </div>
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <GapSentence
              before={round.before}
              after={round.after}
              length={round.answer.length}
              hint={round.entry.lemma}
              {...(answered ? { reveal: { text: round.answer, tone: answered.correct ? ('good' as const) : ('again' as const) } } : {})}
            />
          </div>
          {answered ? <SpeakerButton id="game-sentence" text={sentence} label="Escuchar la frase" className="-mr-2 -mt-1 shrink-0" /> : null}
        </div>

        <AnswerInput value={typed} onChange={setTyped} onSubmit={() => check()} label="Escribe la forma que falta" disabled={answered !== null} inputRef={inputRef} />

        {answered ? (
          answered.result && answered.result.verdict !== 'empty' ? (
            <Verdict result={answered.result} typed={typed} />
          ) : (
            <ResultBanner correct={false}>
              <p className="text-body font-medium">Era «{round.answer}»</p>
            </ResultBanner>
          )
        ) : null}
        {answered && round.meaningEs ? (
          <p className="text-secondary text-text-2">
            {round.answer}: {round.meaningEs}
          </p>
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

/** Familias (spec §8): the nouns, adjectives and adverbs that share a root. */
export default function FamilyGame({ words, variant, pick, autoPlayAudio, record, turns, onFinish, onExit }: GamePlayProps) {
  const mode: FamilyMode = variant === 'sentences' ? 'sentences' : 'mixed'
  const [rounds] = useState<FamilyRound[]>(() => planFamily(words, { mode, turns, pick }))
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [missed, setMissed] = useState<Entry[]>([])
  const [startedAt] = useState(clock)
  const round = rounds[index]

  if (!round) {
    return (
      <GameShell label="Familias" progress={0} counter="" onExit={onExit}>
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
  const shared = { autoPlayAudio, last: index + 1 === rounds.length, onAnswered: answered, onNext: next }

  return (
    <GameShell label="Familias" progress={index / rounds.length} counter={`${index + 1} de ${rounds.length}`} onExit={onExit}>
      {round.kind === 'slots' ? <SlotsView key={index} round={round} {...shared} /> : <SentenceView key={index} round={round} {...shared} />}
    </GameShell>
  )
}
