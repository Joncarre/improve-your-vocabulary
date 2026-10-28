import { z } from 'zod'
import { AI_LIMITS, AiMetaSchema } from './enrich.js'
import { CefrSchema, PartOfSpeechSchema } from './model.js'

/*
 * Contract of the `story` action of POST /api/ai (spec §13), shared by the server and the client.
 *
 * The model returns where it thinks each word sits in the text (`start`/`end`), but models count
 * characters badly (risk R12): `locateTargets` throws those numbers away and finds every word again.
 */

/** Words of one story. The game asks for 6 to 8; the server only guards the size of the request. */
export const STORY_WORDS = { min: 1, max: 10 } as const

export const StoryWordSchema = z.object({
  lemma: z.string().trim().min(1).max(AI_LIMITS.wordMax),
  pos: PartOfSpeechSchema,
})
export type StoryWord = z.infer<typeof StoryWordSchema>

export const StoryPayloadSchema = z.object({
  words: z.array(StoryWordSchema).min(STORY_WORDS.min).max(STORY_WORDS.max),
  level: CefrSchema.default('B1'),
})
export type StoryPayload = z.output<typeof StoryPayloadSchema>
export type StoryPayloadInput = z.input<typeof StoryPayloadSchema>

/** Model-facing output: closed objects, plain numbers (structured outputs take no constraints). */
export const StoryTargetSchema = z.object({
  lemma: z.string(),
  /** The word exactly as it appears in `textEn` ("went" for "go"), as one contiguous fragment. */
  surfaceForm: z.string(),
  start: z.number(),
  end: z.number(),
})
export type StoryTarget = z.infer<typeof StoryTargetSchema>

export const StoryOutputSchema = z.object({
  title: z.string(),
  textEn: z.string(),
  textEs: z.string(),
  targets: z.array(StoryTargetSchema),
})
export type StoryOutput = z.infer<typeof StoryOutputSchema>

export const StoryResponseSchema = z.object({ ok: z.literal(true), data: StoryOutputSchema, meta: AiMetaSchema })
export type StoryResponse = z.infer<typeof StoryResponseSchema>

/* ---------- Locating the words ---------- */

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const key = (text: string) => text.normalize('NFC').toLowerCase().replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ').trim()

interface Span {
  start: number
  end: number
}

/** Every place where `fragment` appears as a whole word (or words), in any letter case. */
function occurrences(text: string, fragment: string): Span[] {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(fragment).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}])`, 'giu')
  return [...text.matchAll(pattern)].map((found) => ({ start: found.index, end: found.index + found[0].length }))
}

const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end

/**
 * Finds again every target in `text`. For each one it takes the occurrence of its surface form closest to
 * the place the model claimed that does not overlap a word already placed; a target that cannot be found is
 * dropped, and a lemma is placed once. The result is in reading order and its `surfaceForm` is the exact text.
 */
export function locateTargets(text: string, targets: readonly StoryTarget[]): StoryTarget[] {
  const placed: StoryTarget[] = []
  const lemmas = new Set<string>()
  for (const target of targets) {
    const lemma = target.lemma.trim()
    const surface = target.surfaceForm.trim()
    if (!lemma || !surface || lemmas.has(key(lemma))) continue

    const claimed = Number.isFinite(target.start) ? target.start : 0
    const best = occurrences(text, surface)
      .filter((span) => !placed.some((other) => overlaps(span, other)))
      .sort((a, b) => Math.abs(a.start - claimed) - Math.abs(b.start - claimed))[0]
    if (!best) continue

    lemmas.add(key(lemma))
    placed.push({ lemma, surfaceForm: text.slice(best.start, best.end), start: best.start, end: best.end })
  }
  return placed.sort((a, b) => a.start - b.start)
}

/** Words that must be found in the text for a story to be worth playing: three of every four asked for. */
export function storyTargetsNeeded(requested: number): number {
  return Math.max(1, Math.ceil(requested * 0.75))
}

/**
 * Tidies a story and puts every target back in place. Only words that were asked for survive, and each is
 * given the lemma of the request (so the game can tell which word it is), whatever case the model used.
 */
export function normalizeStory(output: StoryOutput, words: readonly Pick<StoryWord, 'lemma'>[]): StoryOutput {
  const textEn = output.textEn.trim()
  const asked = new Map(words.map((word) => [key(word.lemma), word.lemma]))
  const known = output.targets.flatMap((target) => {
    const lemma = asked.get(key(target.lemma))
    return lemma === undefined ? [] : [{ ...target, lemma }]
  })
  return {
    title: output.title.trim(),
    textEn,
    textEs: output.textEs.trim(),
    targets: locateTargets(textEn, known),
  }
}
