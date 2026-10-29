import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

type Rgb = [number, number, number]

const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8')

/** Reads every `--color-name: #rrggbb;` declaration from the design tokens. */
function parseColors(source: string): Map<string, Rgb> {
  const colors = new Map<string, Rgb>()
  for (const match of source.matchAll(/--color-([a-z0-9-]+):\s*#([0-9a-f]{6})\s*;/gi)) {
    const [, name, hex] = match
    if (!name || !hex) continue
    colors.set(name, [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as Rgb)
  }
  return colors
}

const colors = parseColors(css)

function color(name: string): Rgb {
  const value = colors.get(name)
  if (!value) throw new Error(`Missing design token --color-${name}`)
  return value
}

function luminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const srgb = value / 255
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG 2 contrast ratio between two colours. */
function ratio(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (lighter + 0.05) / (darker + 0.05)
}

/** `foreground` at the given opacity over `background`. */
function mix(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return foreground.map((value, index) => Math.round(value * alpha + (background[index] ?? 0) * (1 - alpha))) as Rgb
}

const AA = 4.5
const SURFACES = ['bg', 'surface', 'surface-2']
const TEXT_TOKENS = ['text', 'text-2', 'text-3', 'accent']
const PASTELS = ['again', 'hard', 'good', 'easy', 'noun', 'verb', 'adjective', 'adverb', 'phrasal', 'idiom', 'other']

describe('design tokens', () => {
  it('defines every colour the spec names', () => {
    for (const name of [...SURFACES, ...TEXT_TOKENS, ...PASTELS]) {
      expect(colors.has(name), name).toBe(true)
    }
  })

  it.each(TEXT_TOKENS)('text colour %s is AA on every surface', (name) => {
    for (const surface of SURFACES) {
      expect(ratio(color(name), color(surface)), `${name} on ${surface}`).toBeGreaterThanOrEqual(AA)
    }
  })

  it.each(PASTELS)('pastel %s is AA as text on every surface', (name) => {
    for (const surface of SURFACES) {
      expect(ratio(color(name), color(surface)), `${name} on ${surface}`).toBeGreaterThanOrEqual(AA)
    }
  })

  it.each(PASTELS)('pastel %s is AA as chip text over its own 14 % tint', (name) => {
    for (const surface of SURFACES) {
      const tint = mix(color(name), color(surface), 0.14)
      expect(ratio(color(name), tint), `${name} chip on ${surface}`).toBeGreaterThanOrEqual(AA)
    }
  })

  it.each(PASTELS)('dark text is AA on a filled %s button or tile', (name) => {
    expect(ratio(color('bg'), color(name))).toBeGreaterThanOrEqual(AA)
  })

  it('the secondary grey is AA on the accent tint of a chosen option (the dimmest grey is not: it must not be used there)', () => {
    for (const surface of SURFACES) {
      const tint = mix(color('accent'), color(surface), 0.15)
      expect(ratio(color('text-2'), tint), `text-2 on ${surface}`).toBeGreaterThanOrEqual(AA)
    }
    expect(ratio(color('text-3'), mix(color('accent'), color('surface-2'), 0.15))).toBeLessThan(AA)
  })
})
