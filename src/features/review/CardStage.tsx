import { useEffect, useRef, useState } from 'react'
import { playAudio } from '../../audio/useSpeech.ts'
import { primeSpeech } from '../../audio/speech.ts'
import { checkAnswer, type CheckResult } from '../../srs/checker.ts'
import type { Grade } from '../../srs/scheduler.ts'
import { FlipCard } from './FlipCard.tsx'
import { ProductionBack, ProductionFront } from './ProductionCard.tsx'
import { RatingBar } from './RatingBar.tsx'
import { RecognitionBack, RecognitionFront } from './RecognitionCard.tsx'
import type { ReviewSession } from './useReviewSession.ts'
import { useSwipe } from './useSwipe.ts'

interface CardStageProps {
  session: ReviewSession
  /** An extra review: two buttons and no intervals. */
  extra: boolean
  autoPlayAudio: boolean
}

/**
 * One card on screen: the turning card, the buttons under it, the swipe, the keyboard and the
 * automatic audio. It is created again for every card, so each one starts face up and empty.
 */
export function CardStage({ session, extra, autoPlayAudio }: CardStageProps) {
  const { item, model, preview, busy } = session
  const [revealed, setRevealed] = useState(false)
  const [typed, setTyped] = useState('')
  const [result, setResult] = useState<CheckResult | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const suggested: Grade | null = result?.suggestedGrade ?? null

  const reveal = () => {
    if (revealed || !model) return
    if (model.type === 'production') {
      setResult(typed.trim() ? checkAnswer(typed, model.accepted) : null)
      // Hearing the answer is part of the lesson (inside the tap, so iOS allows it).
      if (autoPlayAudio) playAudio({ key: 'review-answer', text: model.cloze?.answer ?? model.entry.lemma })
    }
    setRevealed(true)
  }

  const grade = (given: Grade) => {
    if (!revealed || busy) return
    primeSpeech()
    void session.grade(extra && given === 2 ? 1 : given)
  }

  // The word is spoken as soon as a recognition card appears; a written card is not (it would give the answer away).
  useEffect(() => {
    if (autoPlayAudio && model?.type === 'recognition') {
      playAudio({ key: 'review-word', text: model.entry.lemma, audioUrl: model.entry.audioUrl })
    }
    if (model?.type === 'production' && window.matchMedia?.('(pointer: fine)').matches) inputRef.current?.focus()
    // Once per card: this component is created again for each one.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [])

  // Keyboard: Space or Enter turns the card and then accepts the suggested rating; 1-4 rate.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, button, a, [role=dialog]')) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        if (revealed) grade(suggested ?? 3)
        else reveal()
      } else if (revealed && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault()
        if (!extra || event.key === '1' || event.key === '3') grade(Number(event.key) as Grade)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  const swipe = useSwipe({ enabled: revealed && !busy, onLeft: () => grade(1), onRight: () => grade(3) })

  if (!item || !model) return null
  const revealLabel = model.type === 'production' && typed.trim() ? 'Comprobar' : 'Mostrar respuesta'

  return (
    <>
      <div className="mx-auto min-h-0 w-full max-w-[560px] flex-1 px-4 pb-2">
        <div
          {...swipe.handlers}
          style={swipe.style}
          className={`h-full rounded-sheet ${swipe.side === 'left' ? 'ring-2 ring-again' : swipe.side === 'right' ? 'ring-2 ring-good' : ''}`}
        >
          {model.type === 'recognition' ? (
            <FlipCard flipped={revealed} onFrontTap={reveal} front={<RecognitionFront model={model} />} back={<RecognitionBack model={model} />} />
          ) : (
            <FlipCard
              flipped={revealed}
              front={<ProductionFront model={model} value={typed} onChange={setTyped} onSubmit={reveal} inputRef={inputRef} />}
              back={<ProductionBack model={model} result={result} typed={typed} />}
            />
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[560px] px-4 pt-1">
        <RatingBar revealed={revealed} revealLabel={revealLabel} onReveal={reveal} preview={extra ? undefined : preview} suggested={suggested} busy={busy} onGrade={grade} />
        <p className="mt-1.5 hidden text-center text-caption text-text-3 lg:block">
          {revealed ? (extra ? '1 Otra vez · 3 Bien' : '1 Otra vez · 2 Difícil · 3 Bien · 4 Fácil') : 'Espacio o Intro para mostrar'} · Z deshacer · Esc salir
        </p>
        {!revealed ? null : <p className="mt-1.5 text-center text-caption text-text-3 lg:hidden">Desliza: izquierda «Otra vez», derecha «Bien»</p>}
      </div>
    </>
  )
}
