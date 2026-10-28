import { Turtle, Volume2 } from 'lucide-react'
import { playAudio, stopAudio, usePlayingKey } from '../audio/useSpeech.ts'
import { ICON_BUTTON_CLASS } from './classes.ts'

interface SpeakerButtonProps {
  /** Unique on the page: lets the button show that it is playing. */
  id: string
  text: string
  /** UK recording of the word, when it has one (used for words only, never for sentences). */
  audioUrl?: string | undefined
  /** Accessible name, e.g. "Escuchar «go»". */
  label: string
  /** The slow version (0.7 speed). */
  slow?: boolean
  className?: string
}

/** Plays `text` in British English; a second tap while it plays stops it. 44 x 44 pt touch target. */
export function SpeakerButton({ id, text, audioUrl, label, slow = false, className = '' }: SpeakerButtonProps) {
  const playing = usePlayingKey() === id
  const Icon = slow ? Turtle : Volume2
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => (playing ? stopAudio() : playAudio({ key: id, text, audioUrl, slow }))}
      className={`${ICON_BUTTON_CLASS} ${playing ? 'text-accent' : ''} ${className}`.trim()}
    >
      <Icon size={18} strokeWidth={1.75} className={playing ? 'animate-pulse motion-reduce:animate-none' : ''} aria-hidden="true" />
    </button>
  )
}
