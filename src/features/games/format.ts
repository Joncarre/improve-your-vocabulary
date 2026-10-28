/** "0:07", "1:05": minutes and seconds, as a stopwatch shows them. */
export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
