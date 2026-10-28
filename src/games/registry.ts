import type { Card, GameId, Source, Topic } from '../shared/index.ts'
import { hasClozeGap } from './cloze.ts'
import { BOARD_WORDS, hasConnectionsBoard, wordsWithLinks } from './connections.ts'
import { isFamilyPlayable, type FamilyMode } from './family.ts'
import { distinctForMatch, type MatchVariant } from './match.ts'
import { hasVerbForms } from './verbForms.ts'
import type { GameWord } from './words.ts'

export interface VariantOption {
  value: string
  label: string
  hint?: string
}

export interface GameInfo {
  id: GameId
  name: string
  blurb: string
  /** Words needed to play (spec §8). */
  min: number
  /** False for the games that arrive in a later phase. */
  ready: boolean
  /** The card an answer counts for: Parejas shows English with its meaning; the other games ask for English. */
  card: Card['type']
  variants?: { options: VariantOption[]; fallback: string }
  /** Needs the AI (and so a connection) to prepare a game, as Historia does. */
  needsConnection?: boolean
}

export const GAMES: readonly GameInfo[] = [
  {
    id: 'match',
    name: 'Parejas',
    blurb: 'Une cada palabra con su pareja contra el reloj.',
    min: 6,
    ready: true,
    card: 'recognition',
    variants: {
      fallback: 'es',
      options: [
        { value: 'es', label: 'Inglés ↔ español' },
        { value: 'definition', label: 'Palabra ↔ definición' },
        { value: 'ipa', label: 'Palabra ↔ IPA', hint: 'Avanzado' },
      ],
    },
  },
  {
    id: 'cloze',
    name: 'Huecos',
    blurb: 'Completa la frase con la palabra, en su forma correcta.',
    min: 4,
    ready: true,
    card: 'production',
    variants: {
      fallback: 'choose',
      options: [
        { value: 'choose', label: 'Nivel 1', hint: 'Elegir entre cuatro' },
        { value: 'type', label: 'Nivel 2', hint: 'Escribir' },
      ],
    },
  },
  {
    id: 'verb_forms',
    name: 'Formas verbales',
    blurb: 'Pasado simple y participio de tus verbos, los irregulares primero.',
    min: 5,
    ready: true,
    card: 'production',
    variants: {
      fallback: 'choose',
      options: [
        { value: 'choose', label: 'Elegir' },
        { value: 'type', label: 'Escribir' },
      ],
    },
  },
  {
    id: 'family',
    name: 'Familias',
    blurb: 'Sustantivo, adjetivo y adverbio de la misma raíz.',
    min: 4,
    ready: true,
    card: 'production',
    variants: {
      fallback: 'mixed',
      options: [
        { value: 'mixed', label: 'Ranuras y frases' },
        { value: 'sentences', label: 'Solo frases' },
      ],
    },
  },
  { id: 'dictation', name: 'Dictado', blurb: 'Escribe lo que oyes, con ortografía británica.', min: 5, ready: true, card: 'production' },
  { id: 'connections', name: 'Conexiones', blurb: 'Separa 16 palabras en 4 grupos con un vínculo oculto.', min: 16, ready: true, card: 'recognition' },
  { id: 'story', name: 'Historia', blurb: 'Un microrrelato con tus palabras más flojas.', min: 6, ready: true, card: 'recognition', needsConnection: true },
]

export function gameInfo(id: string): GameInfo | undefined {
  return GAMES.find((game) => game.id === id)
}

/** The variant to use: the one asked for if the game has it, otherwise the game's default. */
export function resolveVariant(info: GameInfo, variant: string | null | undefined): string {
  return info.variants?.options.some((option) => option.value === variant) ? (variant as string) : (info.variants?.fallback ?? '')
}

/** What some games need besides the words: Conexiones builds its groups from the topics and the sources. */
export interface GameContext {
  topics: readonly Topic[]
  sources: readonly Source[]
}

/**
 * How many of the words can be played in this game (and variant): the number the "Necesitas N palabras" lock compares with `min`.
 * Conexiones is not about how many words there are but about whether they make four clean groups: when they do the count
 * is the 16 of the board, and when they do not it is the words that belong to some group, always below the minimum.
 */
export function playableCount(game: GameId, words: readonly GameWord[], variant: string, context: GameContext): number {
  switch (game) {
    case 'match':
      return distinctForMatch(words, variant as MatchVariant).length
    case 'cloze':
      return words.filter((word) => hasClozeGap(word.entry)).length
    case 'verb_forms':
      return words.filter((word) => hasVerbForms(word.entry)).length
    case 'family':
      return words.filter((word) => isFamilyPlayable(word.entry, variant as FamilyMode)).length
    case 'dictation':
    case 'story':
      return words.length
    case 'connections':
      return hasConnectionsBoard(words, context.topics, context.sources)
        ? BOARD_WORDS
        : Math.min(BOARD_WORDS - 1, wordsWithLinks(words, context.topics, context.sources))
  }
}

export interface Availability {
  playable: number
  min: number
  open: boolean
}

export function availability(info: GameInfo, words: readonly GameWord[], variant: string, context: GameContext): Availability {
  const playable = info.ready ? playableCount(info.id, words, variant, context) : 0
  return { playable, min: info.min, open: info.ready && playable >= info.min }
}
