/**
 * Key used to spot duplicates: lower case, no accents, straight quotes, single spaces and no
 * surrounding punctuation. "  Give  Up. " and "give up" are the same entry.
 */
export function normalizeLemmaKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'([{.,;:!?¿¡-]+|[\s"')\]}.,;:!?…-]+$/g, '')
    .trim()
}
