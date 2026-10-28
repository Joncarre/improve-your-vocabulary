import type { Entry } from '../shared/index.ts'

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** The word as a whole word, in any letter case ("go" must not match inside "going"). */
function wholeWord(target: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(target.trim())}(?![\\p{L}\\p{N}])`, 'iu')
}

export interface HighlightParts {
  before: string
  match: string
  after: string
}

/** Splits `text` around the first whole-word occurrence of `target`, or null when it is not there. */
export function splitHighlight(text: string, target: string | undefined): HighlightParts | null {
  if (!target?.trim()) return null
  const found = wholeWord(target).exec(text)
  if (!found) return null
  return { before: text.slice(0, found.index), match: found[0], after: text.slice(found.index + found[0].length) }
}

/** Every written form of an entry: what was typed, the lemma and all its inflections. */
export function formCandidates(entry: Pick<Entry, 'lemma' | 'seenForm' | 'forms'>): string[] {
  const verb = entry.forms?.verb
  const noun = entry.forms?.noun
  const adjective = entry.forms?.adjective
  const forms = [
    entry.seenForm,
    entry.lemma,
    verb?.base,
    verb?.thirdPerson,
    ...(verb?.pastSimple ?? []),
    ...(verb?.pastParticiple ?? []),
    verb?.presentParticiple,
    noun?.plural,
    adjective?.comparative,
    adjective?.superlative,
  ]
  const clean = forms.map((form) => form?.trim() ?? '').filter(Boolean)
  // Longest first, so "went off on one" wins over "went".
  return [...new Set(clean)].sort((a, b) => b.length - a.length)
}

/**
 * The exact text of `sentence` to highlight: the fragment the AI marked (`surface`) when it is
 * really there, otherwise the longest known form of the word that appears as a whole word.
 */
export function findHighlightTarget(
  sentence: string,
  entry: Pick<Entry, 'lemma' | 'seenForm' | 'forms'>,
  surface?: string,
): string | undefined {
  for (const candidate of [...(surface ? [surface] : []), ...formCandidates(entry)]) {
    const parts = splitHighlight(sentence, candidate)
    if (parts) return parts.match
  }
  return undefined
}
