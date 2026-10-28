/**
 * Text for searching: lower case, no accents, no apostrophes and single spaces, so "Camión" finds
 * "camion" and "don't" finds "dont". (The ñ also loses its tilde: searching ignores accents.)
 */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/['’‘`´]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The words of a search query, normalised. Empty for a blank query. */
export function searchTokens(query: string): string[] {
  const normalised = normalizeSearch(query)
  return normalised ? normalised.split(' ') : []
}
