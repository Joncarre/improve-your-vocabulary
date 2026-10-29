export interface BarRect {
  x: number
  y: number
  width: number
  height: number
}

/** The shortest a bar with something in it may be, so one review among many still shows. */
export const MIN_BAR = 3

/**
 * The bars of a chart `width` x `height` px, side by side with `gap` between them. The tallest bar fills the
 * height (`max` can be set to share a scale), a bar with a value is never shorter than {@link MIN_BAR} and an empty one has no height.
 */
export function barGeometry(values: readonly number[], width: number, height: number, gap: number, max = Math.max(1, ...values)): BarRect[] {
  const count = values.length
  if (count === 0 || width <= 0 || height <= 0) return []
  const barWidth = Math.max(1, (width - gap * (count - 1)) / count)
  return values.map((value, index) => {
    const barHeight = value > 0 ? Math.min(height, Math.max(MIN_BAR, (value / max) * height)) : 0
    return { x: index * (barWidth + gap), y: height - barHeight, width: barWidth, height: barHeight }
  })
}

/** The part of a circle of radius `radius` that `fraction` (0 to 1) covers, as the pair of numbers an SVG `stroke-dasharray` takes. */
export function ringDash(fraction: number, radius: number): { dash: number; gap: number } {
  const circumference = 2 * Math.PI * radius
  const dash = circumference * Math.min(1, Math.max(0, fraction))
  return { dash, gap: circumference - dash }
}

/**
 * Where the labels under the bars go: the first and the last stay at the edges (so they are not cut off) and
 * the rest are centred under their bar. `at` is the position of the middle of the bar, from 0 to 1.
 */
export function tickPlacement(index: number, count: number): { at: number; align: 'start' | 'center' | 'end' } {
  return { at: (index + 0.5) / count, align: index === 0 ? 'start' : index === count - 1 ? 'end' : 'center' }
}
