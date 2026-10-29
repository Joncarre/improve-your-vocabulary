import { describe, expect, it } from 'vitest'
import { barGeometry, MIN_BAR, ringDash, tickPlacement } from '../../../src/features/progress/geometry.ts'

describe('barGeometry', () => {
  it('lays the bars side by side across the whole width, the tallest filling the height', () => {
    const bars = barGeometry([2, 4, 1], 100, 80, 5)
    expect(bars).toHaveLength(3)
    expect(bars[0]?.x).toBe(0)
    expect(bars[2] && bars[2].x + bars[2].width).toBeCloseTo(100)
    expect(bars[1]).toMatchObject({ height: 80, y: 0 })
    expect(bars[0]?.height).toBeCloseTo(40)
    expect(bars[2]?.height).toBeCloseTo(20)
    // They all sit on the floor of the box.
    expect(bars.every((bar) => bar.y + bar.height === 80)).toBe(true)
  })

  it('gives every bar the same width and the same gap', () => {
    const bars = barGeometry([1, 1, 1, 1], 106, 50, 2)
    const widths = new Set(bars.map((bar) => bar.width))
    expect(widths.size).toBe(1)
    expect(bars[1] && bars[0] && bars[1].x - (bars[0].x + bars[0].width)).toBeCloseTo(2)
  })

  it('draws no bar for zero and never a bar so short it cannot be seen', () => {
    const bars = barGeometry([0, 1, 1000], 90, 100, 3)
    expect(bars[0]?.height).toBe(0)
    expect(bars[1]?.height).toBe(MIN_BAR)
    expect(bars[2]?.height).toBe(100)
  })

  it('shares a scale when told the maximum, and never draws above the box', () => {
    const bars = barGeometry([5, 10], 60, 100, 4, 20)
    expect(bars.map((bar) => bar.height)).toEqual([25, 50])
    expect(barGeometry([50], 60, 100, 4, 20)[0]?.height).toBe(100)
  })

  it('draws nothing for no data or no room, and does not divide by zero with only zeros', () => {
    expect(barGeometry([], 100, 100, 3)).toEqual([])
    expect(barGeometry([1], 0, 100, 3)).toEqual([])
    expect(barGeometry([1], 100, 0, 3)).toEqual([])
    expect(barGeometry([0, 0], 100, 50, 3).every((bar) => bar.height === 0 && Number.isFinite(bar.width))).toBe(true)
  })

  it('keeps a bar at least one pixel wide in a very narrow box', () => {
    expect(barGeometry(Array.from({ length: 30 }, () => 1), 20, 50, 2).every((bar) => bar.width >= 1)).toBe(true)
  })
})

describe('ringDash', () => {
  it('covers the part of the circle that was asked for', () => {
    const { dash, gap } = ringDash(0.25, 40)
    expect(dash + gap).toBeCloseTo(2 * Math.PI * 40)
    expect(dash).toBeCloseTo((2 * Math.PI * 40) / 4)
  })

  it('stays between empty and full', () => {
    expect(ringDash(-1, 10).dash).toBe(0)
    expect(ringDash(5, 10).gap).toBeCloseTo(0)
    expect(ringDash(1, 10).dash).toBeCloseTo(2 * Math.PI * 10)
  })
})

describe('tickPlacement', () => {
  it('keeps the first and the last label at the edges and centres the others under their bar', () => {
    expect(tickPlacement(0, 7).align).toBe('start')
    expect(tickPlacement(6, 7).align).toBe('end')
    expect(tickPlacement(3, 7)).toEqual({ at: 0.5, align: 'center' })
    expect(tickPlacement(1, 4).at).toBeCloseTo(0.375)
  })

  it('has one label at the start when there is a single bar', () => {
    expect(tickPlacement(0, 1).align).toBe('start')
  })
})
