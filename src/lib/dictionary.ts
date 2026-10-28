import { z } from 'zod'
import type { Example, PartOfSpeech } from '../shared/index.ts'

/* Free Dictionary API (https://dictionaryapi.dev): no key, no AI. Used as a fallback when the AI is unavailable. */

const DICTIONARY_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/'

const EntrySchema = z.object({
  phonetic: z.string().optional(),
  phonetics: z.array(z.object({ text: z.string().optional(), audio: z.string().optional() })).default([]),
  meanings: z
    .array(
      z.object({
        partOfSpeech: z.string(),
        definitions: z
          .array(
            z.object({
              definition: z.string(),
              example: z.string().optional(),
              synonyms: z.array(z.string()).default([]),
              antonyms: z.array(z.string()).default([]),
            }),
          )
          .default([]),
        synonyms: z.array(z.string()).default([]),
        antonyms: z.array(z.string()).default([]),
      }),
    )
    .default([]),
})

export interface DictionarySense {
  pos: PartOfSpeech
  definitionEn: string
  examples: Example[]
}

export interface DictionaryResult {
  /** British IPA between slashes, or "" when the dictionary has none. */
  ipa: string
  /** UK recording; only URLs marked as British are kept. */
  audioUrl: string
  senses: DictionarySense[]
  synonyms: string[]
  antonyms: string[]
}

const POS_MAP: Record<string, PartOfSpeech> = {
  noun: 'noun',
  verb: 'verb',
  adjective: 'adjective',
  adverb: 'adverb',
  preposition: 'preposition',
  conjunction: 'conjunction',
  pronoun: 'pronoun',
  determiner: 'determiner',
  interjection: 'interjection',
  exclamation: 'interjection',
}

/** Recordings are named "word-uk.mp3" or "word_gb_1.mp3" for British speakers ("-us", "-au" are not wanted). */
export function isUkAudio(url: string | undefined): url is string {
  return Boolean(url) && /(?:-uk\b|_gb_)/i.test(url as string)
}

function formatIpa(raw: string | undefined): string {
  const inner = (raw ?? '').trim().replace(/^[/[]+|[/\]]+$/g, '').trim()
  return inner ? `/${inner}/` : ''
}

function unique(list: string[], max: number): string[] {
  return [...new Set(list.map((item) => item.trim()).filter(Boolean))].slice(0, max)
}

/** Pure part of the lookup: picks the British IPA and audio and the first definitions. */
export function parseDictionaryResponse(json: unknown): DictionaryResult | null {
  const parsed = z.array(EntrySchema).safeParse(json)
  if (!parsed.success || parsed.data.length === 0) return null
  const entries = parsed.data

  const phonetics = entries.flatMap((entry) => entry.phonetics)
  const british = phonetics.find((item) => item.text && isUkAudio(item.audio))
  const ipa = formatIpa(
    british?.text ?? phonetics.find((item) => item.text)?.text ?? entries.find((entry) => entry.phonetic)?.phonetic,
  )
  const audioUrl = phonetics.map((item) => item.audio).find(isUkAudio) ?? ''

  const meanings = entries.flatMap((entry) => entry.meanings)
  const senses = meanings
    .flatMap((meaning): DictionarySense[] => {
      const first = meaning.definitions[0]
      if (!first) return []
      return [
        {
          pos: POS_MAP[meaning.partOfSpeech.toLowerCase()] ?? 'expression',
          definitionEn: first.definition.trim(),
          examples: first.example ? [{ en: first.example.trim(), es: '' }] : [],
        },
      ]
    })
    .slice(0, 4)

  return {
    ipa,
    audioUrl,
    senses,
    synonyms: unique(
      meanings.flatMap((meaning) => [...meaning.synonyms, ...meaning.definitions.flatMap((d) => d.synonyms)]),
      4,
    ),
    antonyms: unique(
      meanings.flatMap((meaning) => [...meaning.antonyms, ...meaning.definitions.flatMap((d) => d.antonyms)]),
      4,
    ),
  }
}

/** Looks a word up; resolves to null when the dictionary does not know it or cannot be reached. */
export async function lookupDictionary(
  word: string,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<DictionaryResult | null> {
  const fetchImpl = options.fetchImpl ?? fetch
  try {
    const response = await fetchImpl(`${DICTIONARY_URL}${encodeURIComponent(word.trim().toLowerCase())}`, {
      ...(options.signal ? { signal: options.signal } : {}),
    })
    if (!response.ok) return null
    return parseDictionaryResponse(await response.json())
  } catch {
    return null
  }
}
