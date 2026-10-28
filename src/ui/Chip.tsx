import type { ReactNode } from 'react'

export type ChipTone =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'phrasal'
  | 'idiom'
  | 'other'
  | 'accent'
  | 'again'
  | 'hard'
  | 'good'
  | 'easy'

// Pastel text on a 14 % tint of the same colour (class names are spelled out so Tailwind sees them).
const TONES: Record<ChipTone, string> = {
  noun: 'bg-noun/14 text-noun',
  verb: 'bg-verb/14 text-verb',
  adjective: 'bg-adjective/14 text-adjective',
  adverb: 'bg-adverb/14 text-adverb',
  phrasal: 'bg-phrasal/14 text-phrasal',
  idiom: 'bg-idiom/14 text-idiom',
  other: 'bg-other/14 text-other',
  accent: 'bg-accent/14 text-accent',
  again: 'bg-again/14 text-again',
  hard: 'bg-hard/14 text-hard',
  good: 'bg-good/14 text-good',
  easy: 'bg-easy/14 text-easy',
}

export function Chip({ tone = 'other', children }: { tone?: ChipTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-chip px-2 text-chip font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}
