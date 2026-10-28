import { Languages, Square, Turtle, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { playAudio, stopAudio } from '../../../audio/useSpeech.ts'
import { storySegments, type StoryGap } from '../../../games/story.ts'
import { mainSense } from '../../../games/words.ts'
import { POS_LABEL_ES, posTone } from '../../../lib/pos.ts'
import type { Story } from '../../../shared/index.ts'
import { Button } from '../../../ui/Button.tsx'
import { Chip } from '../../../ui/Chip.tsx'
import { ModalSheet } from '../../../ui/ModalSheet.tsx'
import { SpeakerButton } from '../../../ui/SpeakerButton.tsx'
import { GameShell } from '../GameShell.tsx'

/** The text in sentences: a long text is read out one sentence at a time, which keeps every device's voice going to the end. */
function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

interface StoryReadingProps {
  story: Story
  gaps: StoryGap[]
  onContinue: () => void
  onExit: () => void
}

/** First the story, to read and to listen to, with the words you are learning marked: tap one to see what it is. */
export function StoryReading({ story, gaps, onContinue, onExit }: StoryReadingProps) {
  const [open, setOpen] = useState<StoryGap | null>(null)
  const [translated, setTranslated] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  // Each reading has a number, so starting another (or leaving) ends the old one.
  const reading = useRef(0)

  useEffect(
    () => () => {
      reading.current += 1
    },
    [],
  )

  const readAloud = (slow: boolean) => {
    reading.current += 1
    const mine = reading.current
    setSpeaking(true)
    void (async () => {
      for (const sentence of sentencesOf(story.textEn)) {
        if (mine !== reading.current) return
        const kind = await playAudio({ key: 'game-story', text: sentence, slow })
        if (kind === 'none') break
      }
      if (mine === reading.current) setSpeaking(false)
    })()
  }
  const stopReading = () => {
    reading.current += 1
    stopAudio()
    setSpeaking(false)
  }

  const sense = open ? mainSense(open.entry) : undefined

  return (
    <GameShell label="Historia" progress={0} counter="Primero, a leer" onExit={onExit}>
      <div className="mx-auto min-h-0 w-full max-w-[560px] flex-1 space-y-4 overflow-y-auto px-4 pb-3">
        <h1 className="font-serif text-word-entry font-medium [overflow-wrap:anywhere]">{story.title}</h1>

        <div className="flex flex-wrap gap-2">
          {speaking ? (
            <Button className="h-11 gap-2" onClick={stopReading}>
              <Square size={16} strokeWidth={1.75} aria-hidden="true" />
              Parar
            </Button>
          ) : (
            <>
              <Button className="h-11 gap-2" onClick={() => readAloud(false)}>
                <Volume2 size={18} strokeWidth={1.75} aria-hidden="true" />
                Escuchar
              </Button>
              <Button className="h-11 gap-2" onClick={() => readAloud(true)}>
                <Turtle size={18} strokeWidth={1.75} aria-hidden="true" />
                Más lento
              </Button>
            </>
          )}
          <Button className="h-11 gap-2" aria-pressed={translated} onClick={() => setTranslated((value) => !value)}>
            <Languages size={18} strokeWidth={1.75} aria-hidden="true" />
            {translated ? 'Ocultar traducción' : 'Traducir'}
          </Button>
        </div>

        <p lang="en" className="text-[19px] leading-relaxed [overflow-wrap:anywhere]">
          {storySegments(story.textEn, gaps).map((segment, index) =>
            segment.kind === 'text' ? (
              segment.text
            ) : (
              <button
                key={index}
                type="button"
                onClick={() => setOpen(segment.gap)}
                className="mx-px rounded-sm bg-accent/15 px-1 font-semibold text-accent underline decoration-accent/50 decoration-1 underline-offset-4 active:bg-accent/25"
              >
                {segment.gap.answer}
              </button>
            ),
          )}
        </p>
        <p className="text-caption text-text-3">Toca una palabra marcada para ver qué significa.</p>

        {translated ? <p className="rounded-card border border-border bg-surface-2 p-3 text-body text-text-2">{story.textEs}</p> : null}
      </div>

      <div className="mx-auto w-full max-w-[560px] px-4 pt-1">
        <Button variant="primary" className="h-12 w-full text-[16px]" onClick={onContinue}>
          Pasar a los huecos
        </Button>
      </div>

      {open ? (
        <ModalSheet title={open.entry.lemma} onClose={() => setOpen(null)}>
          <div className="space-y-2 pb-2">
            <div className="flex items-center gap-2">
              {sense ? <Chip tone={posTone(sense.pos)}>{POS_LABEL_ES[sense.pos]}</Chip> : null}
              {open.answer.toLowerCase() !== open.entry.lemma.toLowerCase() ? <span className="text-secondary text-text-2">en el texto: «{open.answer}»</span> : null}
            </div>
            <div className="flex items-center gap-1">
              {open.entry.ipa ? <span className="ipa text-ipa text-text-2">{open.entry.ipa}</span> : null}
              <SpeakerButton id="game-story-word" text={open.entry.lemma} audioUrl={open.entry.audioUrl} label={`Escuchar «${open.entry.lemma}»`} />
            </div>
            {sense?.meaningEs ? <p className="text-body">{sense.meaningEs}</p> : null}
            {sense?.definitionEn ? <p className="text-secondary text-text-2">{sense.definitionEn}</p> : null}
          </div>
        </ModalSheet>
      ) : null}
    </GameShell>
  )
}
