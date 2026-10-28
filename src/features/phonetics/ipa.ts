import { MARK_BY_SYMBOL, SOUND_BY_SYMBOL, SOUNDS, type Mark, type Sound } from './sounds.ts'

export type IpaToken =
  | { kind: 'sound'; sound: Sound; text: string }
  | { kind: 'stress'; mark: Mark; text: string }
  | { kind: 'space' }
  /** A character this guide does not know. */
  | { kind: 'unknown'; text: string }

/** Other ways dictionaries write the same RP sounds (all of them map to what the guide explains). */
const ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['g', 'ɡ'], // ASCII g -> IPA script g
  ['ɛ', 'e'],
  ['ɹ', 'r'],
  ['ɫ', 'l'],
  ['ʧ', 'tʃ'],
  ['ʤ', 'dʒ'],
  ["'", 'ˈ'],
]

/** Brackets, syllable dots, tie bars and syllabic marks carry no sound of their own. */
const IGNORED = /[/[\]().‿]|[̩̍͜͡]/gu

// Longest first, so "tʃ" is read before "t" and "iː" before "i".
const SYMBOLS = [...SOUNDS.map((sound) => sound.symbol)].sort((a, b) => b.length - a.length)

/**
 * Splits a transcription ("/ˈnækəd/") into sounds, stress marks and word gaps. Anything it does not
 * recognise comes back as `unknown`, so the caller can warn instead of silently skipping it.
 */
export function tokenizeIpa(ipa: string): IpaToken[] {
  let text = ipa.normalize('NFC').replace(IGNORED, '')
  for (const [from, to] of ALIASES) text = text.split(from).join(to)

  const tokens: IpaToken[] = []
  let index = 0
  while (index < text.length) {
    const char = text.charAt(index)

    if (/\s/u.test(char)) {
      if (tokens.length > 0 && tokens.at(-1)?.kind !== 'space') tokens.push({ kind: 'space' })
      index += 1
      continue
    }

    const mark = MARK_BY_SYMBOL.get(char)
    if (mark && char !== 'ː') {
      tokens.push({ kind: 'stress', mark, text: char })
      index += 1
      continue
    }

    const symbol = SYMBOLS.find((candidate) => text.startsWith(candidate, index))
    const sound = symbol ? SOUND_BY_SYMBOL.get(symbol) : undefined
    if (symbol && sound) {
      tokens.push({ kind: 'sound', sound, text: symbol })
      index += symbol.length
      continue
    }

    // A stray length mark after a sound that has no long form in the guide: show it as unknown.
    tokens.push({ kind: 'unknown', text: char })
    index += 1
  }

  while (tokens.at(-1)?.kind === 'space') tokens.pop()
  return tokens
}

export function hasUnknownSymbols(tokens: readonly IpaToken[]): boolean {
  return tokens.some((token) => token.kind === 'unknown')
}

/** The different sounds and stress marks of a word, in order of first appearance. */
export function distinctItems(tokens: readonly IpaToken[]): Array<Extract<IpaToken, { kind: 'sound' | 'stress' }>> {
  const seen = new Set<string>()
  const items: Array<Extract<IpaToken, { kind: 'sound' | 'stress' }>> = []
  for (const token of tokens) {
    if (token.kind !== 'sound' && token.kind !== 'stress') continue
    if (seen.has(token.text)) continue
    seen.add(token.text)
    items.push(token)
  }
  return items
}
