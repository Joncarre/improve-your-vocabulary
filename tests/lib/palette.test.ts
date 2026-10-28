import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { pickTopicColor, TOPIC_COLORS } from '../../src/lib/palette.ts'

const tokens = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8').toLowerCase()

describe('TOPIC_COLORS', () => {
  it.each([...TOPIC_COLORS])('%s is one of the pastel design tokens', (color) => {
    expect(tokens).toContain(`: ${color};`)
  })
})

describe('pickTopicColor', () => {
  it('starts with the first colour', () => {
    expect(pickTopicColor([])).toBe(TOPIC_COLORS[0])
  })

  it('skips colours that are already used', () => {
    expect(pickTopicColor([TOPIC_COLORS[0], TOPIC_COLORS[1]])).toBe(TOPIC_COLORS[2])
  })

  it('ignores letter case when comparing', () => {
    expect(pickTopicColor([TOPIC_COLORS[0].toUpperCase()])).toBe(TOPIC_COLORS[1])
  })

  it('reuses the least used colour once all of them are taken', () => {
    const allTwiceExceptLast = [...TOPIC_COLORS, ...TOPIC_COLORS.slice(0, -1)]
    expect(pickTopicColor(allTwiceExceptLast)).toBe(TOPIC_COLORS[TOPIC_COLORS.length - 1])
  })
})
