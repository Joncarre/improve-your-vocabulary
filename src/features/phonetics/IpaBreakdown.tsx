import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { playAudio } from '../../audio/useSpeech.ts'
import { distinctItems, hasUnknownSymbols, tokenizeIpa } from './ipa.ts'

interface IpaBreakdownProps {
  ipa: string
  /** Open from the start (in the guide); closed in the entry page. */
  defaultOpen?: boolean
  /** Prefix that keeps the tile ids unique on the page. */
  idPrefix?: string
}

/**
 * "¿Cómo se lee?": the transcription of a word symbol by symbol, with what each one sounds like in
 * Spanish. Tapping a sound plays its first example word.
 */
export function IpaBreakdown({ ipa, defaultOpen = false, idPrefix = 'bd' }: IpaBreakdownProps) {
  const tokens = tokenizeIpa(ipa)
  const items = distinctItems(tokens)
  if (items.length === 0) return null

  return (
    <details open={defaultOpen} className="group mt-1">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-secondary text-accent marker:hidden [&::-webkit-details-marker]:hidden">
        <ChevronRight size={14} aria-hidden="true" className="transition-transform group-open:rotate-90 motion-reduce:transition-none" />
        ¿Cómo se lee?
      </summary>

      <ul className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const example = item.kind === 'sound' ? item.sound.examples[0] : item.mark.examples[0]
          const hint = item.kind === 'sound' ? item.sound.hint : item.mark.hint
          const body = (
            <>
              <span className="ipa block text-[22px] leading-none text-accent">{item.text}</span>
              {item.kind === 'stress' ? (
                <span className="mt-1.5 block text-caption font-medium text-text">{item.mark.name}</span>
              ) : null}
              <span className="mt-1 block text-caption text-text-2">{hint}</span>
              {example && item.kind === 'sound' ? (
                <span className="mt-0.5 block text-caption text-text-3">como en «{example.word}»</span>
              ) : null}
            </>
          )
          return (
            <li key={item.text}>
              {example && item.kind === 'sound' ? (
                <button
                  type="button"
                  aria-label={`${item.text}: ${hint}. Escuchar «${example.word}»`}
                  onClick={() => playAudio({ key: `${idPrefix}-${item.text}`, text: example.word })}
                  className="h-full w-full rounded-card border border-border bg-surface p-2.5 text-left active:bg-surface-2"
                >
                  {body}
                </button>
              ) : (
                <div className="h-full rounded-card border border-border bg-surface p-2.5">{body}</div>
              )}
            </li>
          )
        })}
      </ul>

      {hasUnknownSymbols(tokens) ? (
        <p className="mt-2 text-caption text-text-3">Algún símbolo de esta transcripción no está en la guía.</p>
      ) : null}
      <Link to="/phonetics" className="mt-1 inline-flex min-h-11 items-center text-secondary text-accent">
        Ver la guía completa de pronunciación
      </Link>
    </details>
  )
}
