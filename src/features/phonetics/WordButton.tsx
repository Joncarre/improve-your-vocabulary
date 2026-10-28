import { Volume2 } from 'lucide-react'
import { playAudio, stopAudio, usePlayingKey } from '../../audio/useSpeech.ts'

interface WordButtonProps {
  /** Unique on the page: lets the button show that it is playing. */
  id: string
  word: string
  /** Between slashes; shown next to the word. */
  ipa?: string
}

/** An example word that is spoken in British English when tapped (a second tap stops it). */
export function WordButton({ id, word, ipa }: WordButtonProps) {
  const playing = usePlayingKey() === id
  return (
    <button
      type="button"
      aria-label={`Escuchar «${word}»`}
      onClick={() => (playing ? stopAudio() : playAudio({ key: id, text: word }))}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-control border px-2.5 py-1 transition-colors ${
        playing ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface-2 text-text active:bg-surface'
      }`}
    >
      <Volume2 size={14} strokeWidth={1.75} className={playing ? 'animate-pulse motion-reduce:animate-none' : 'text-text-3'} aria-hidden="true" />
      <span className="text-left">
        <span className="block text-body leading-tight">{word}</span>
        {ipa ? <span className="ipa block text-caption leading-tight text-text-3">{ipa}</span> : null}
      </span>
    </button>
  )
}
