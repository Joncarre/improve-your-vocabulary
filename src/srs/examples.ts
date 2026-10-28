import { findHighlightTarget, splitHighlight } from '../lib/highlight.ts'
import type { Entry, Sense } from '../shared/index.ts'
import { acceptedAnswers } from './checker.ts'

/** A sentence a card can show: one of the user's own or an example of one of the senses. */
export interface ExampleItem {
  key: string
  sentence: string
  translationEs: string
  /** The exact text of the word in the sentence, when known. */
  target: string | undefined
  /** The sense the sentence uses (the back of the card highlights it). */
  senseId: string | undefined
  origin: 'context' | 'example'
}

/**
 * The sentences a word can be reviewed with, in the order they are shown: first the user's own
 * (with the sense of their context), then the examples of all the senses taking turns, so
 * consecutive reviews show different meanings (spec decision 2026-10-28).
 */
export function buildExamplePool(entry: Entry): ExampleItem[] {
  const contextSense = entry.senses.find((sense) => sense.matchesContext) ?? entry.senses[0]
  const contexts: ExampleItem[] = entry.contexts
    .filter((context) => context.sentence.trim())
    .map((context) => ({
      key: `c:${context.id}`,
      sentence: context.sentence.trim(),
      translationEs: context.translationEs?.trim() ?? '',
      target: context.surface,
      senseId: contextSense?.id,
      origin: 'context',
    }))

  const bySense = entry.senses.map((sense) =>
    sense.examples
      .filter((example) => example.en.trim())
      .map<ExampleItem>((example, index) => ({
        key: `e:${sense.id}:${index}`,
        sentence: example.en.trim(),
        translationEs: example.es.trim(),
        target: example.target,
        senseId: sense.id,
        origin: 'example',
      })),
  )
  const taking: ExampleItem[] = []
  const rounds = Math.max(0, ...bySense.map((list) => list.length))
  for (let round = 0; round < rounds; round += 1) {
    for (const list of bySense) {
      const item = list[round]
      if (item) taking.push(item)
    }
  }

  const seen = new Set<string>()
  return [...contexts, ...taking].filter((item) => {
    const key = item.sentence.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** The sentence for the `seen`-th review of a card: it goes round the pool and never repeats until every sentence has been shown. */
export function pickExample(pool: readonly ExampleItem[], seen: number): ExampleItem | undefined {
  return pool.length === 0 ? undefined : pool[((seen % pool.length) + pool.length) % pool.length]
}

export function senseOfExample(entry: Entry, item: ExampleItem | undefined): Sense | undefined {
  return (
    entry.senses.find((sense) => sense.id === item?.senseId) ??
    entry.senses.find((sense) => sense.matchesContext) ??
    entry.senses[0]
  )
}

/** A sentence with the word taken out: "She ____ to leave." */
export interface Cloze {
  before: string
  /** The word as written in the sentence ("went"). */
  answer: string
  after: string
  /** Everything that counts as right (spellings and verb variants included). */
  accepted: string[]
}

/** The gap for `item`, or null when the word cannot be found in the sentence (then the card asks for the base form). */
export function buildCloze(entry: Entry, item: ExampleItem): Cloze | null {
  const target = findHighlightTarget(item.sentence, entry, item.target)
  const parts = splitHighlight(item.sentence, target)
  if (!parts) return null
  return { before: parts.before, answer: parts.match, after: parts.after, accepted: acceptedAnswers(entry, parts.match) }
}
