/** Pastel colours topics can take (same values as the tokens in styles/tokens.css; a test keeps them in sync). */
export const TOPIC_COLORS = [
  '#f3d58a',
  '#9fdcbf',
  '#a9c8f2',
  '#cdb4f0',
  '#f5c29e',
  '#9edfd6',
  '#f2b5d4',
  '#f2a7a7',
  '#b8b8c2',
] as const

/** The first colour nobody uses yet, or the least used one once all of them are taken. */
export function pickTopicColor(usedColors: readonly string[]): string {
  const counts = TOPIC_COLORS.map((color) => usedColors.filter((used) => used.toLowerCase() === color).length)
  const fewest = Math.min(...counts)
  return TOPIC_COLORS[counts.indexOf(fewest)] ?? TOPIC_COLORS[0]
}
