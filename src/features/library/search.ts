import { normalizeSearch, searchTokens } from '../../lib/searchText.ts'
import type { Entry, Source, Topic } from '../../shared/index.ts'

interface IndexedEntry {
  id: string
  /** The word or expression itself. */
  lemma: string
  /** Other forms of the word: what was typed, verb forms, plural, family. */
  forms: string
  /** Meanings in Spanish. */
  meaning: string
  /** Everything else: definitions, examples, your sentences, synonyms, topic and source names. */
  other: string
}

export interface SearchIndex {
  items: readonly IndexedEntry[]
}

function formsOf(entry: Entry): string[] {
  const { verb, noun, adjective } = entry.forms ?? {}
  return [
    entry.seenForm,
    verb?.base,
    verb?.thirdPerson,
    ...(verb?.pastSimple ?? []),
    ...(verb?.pastParticiple ?? []),
    verb?.presentParticiple,
    noun?.plural,
    adjective?.comparative,
    adjective?.superlative,
    ...entry.family.map((member) => member.word),
  ].filter((form): form is string => Boolean(form))
}

/**
 * Builds the index once per change of the collection; searching then only runs `includes` over
 * pre-normalised strings, which stays instant with thousands of words.
 */
export function buildSearchIndex(
  entries: readonly Entry[],
  context: { topics?: readonly Topic[]; sources?: readonly Source[] } = {},
): SearchIndex {
  const topicName = new Map((context.topics ?? []).map((topic) => [topic.id, topic.nameEs]))
  const sourceTitle = new Map((context.sources ?? []).map((source) => [source.id, source.title]))

  return {
    items: entries.map((entry) => ({
      id: entry.id,
      lemma: normalizeSearch(entry.lemma),
      forms: normalizeSearch(formsOf(entry).join(' ')),
      meaning: normalizeSearch(entry.senses.map((sense) => sense.meaningEs).join(' ')),
      other: normalizeSearch(
        [
          ...entry.senses.flatMap((sense) => [
            sense.definitionEn,
            ...sense.examples.flatMap((example) => [example.en, example.es]),
          ]),
          ...entry.synonyms,
          ...entry.antonyms,
          ...entry.collocations,
          ...entry.family.map((member) => member.meaningEs),
          ...entry.contexts.flatMap((context) => [
            context.sentence,
            context.translationEs ?? '',
            sourceTitle.get(context.sourceId ?? '') ?? '',
          ]),
          ...entry.topicIds.map((id) => topicName.get(id) ?? ''),
        ].join(' '),
      ),
    })),
  }
}

const startsWord = (text: string, token: string) => text.startsWith(token) || text.includes(` ${token}`)

/** How well one word of the query matches an entry: the word itself first, then its forms, then its meaning, then the rest. */
function scoreToken(item: IndexedEntry, token: string): number {
  if (item.lemma === token) return 120
  if (item.lemma.startsWith(token)) return 100
  if (startsWord(item.lemma, token)) return 80
  if (item.lemma.includes(token)) return 60
  if (startsWord(item.forms, token)) return 50
  if (item.forms.includes(token)) return 40
  if (startsWord(item.meaning, token)) return 35
  if (item.meaning.includes(token)) return 30
  if (item.other.includes(token)) return 10
  return 0
}

/**
 * Entries that match every word of the query (in English or Spanish, ignoring accents), with a
 * relevance score. `null` means there is no query, so everything matches.
 */
export function searchEntries(index: SearchIndex, query: string): Map<string, number> | null {
  const tokens = searchTokens(query)
  if (tokens.length === 0) return null

  const matches = new Map<string, number>()
  for (const item of index.items) {
    let total = 0
    for (const token of tokens) {
      const score = scoreToken(item, token)
      if (score === 0) {
        total = 0
        break
      }
      total += score
    }
    if (total > 0) matches.set(item.id, total)
  }
  return matches
}
