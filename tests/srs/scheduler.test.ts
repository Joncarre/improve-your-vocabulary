import { FSRSVersion, default_w } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import { newFsrsCard } from '../../src/srs/newCard.ts'
import {
  formatInterval,
  fromTsCard,
  gradeCard,
  LEARNING_STEPS,
  MAX_INTERVAL_DAYS,
  previewGrades,
  RELEARNING_STEPS,
  retrievability,
  schedulerFor,
  toTsCard,
  type Grade,
} from '../../src/srs/scheduler.ts'
import type { FsrsCard } from '../../src/shared/index.ts'

const NOW = Date.UTC(2026, 5, 1, 10, 0, 0)
const MINUTE = 60_000
const DAY = 86_400_000

describe('scheduler configuration', () => {
  it('uses FSRS-6 with the short steps of the spec', () => {
    expect(FSRSVersion).toContain('FSRS-6')
    expect(default_w).toHaveLength(21)
    expect(LEARNING_STEPS).toEqual(['1m', '10m'])
    expect(RELEARNING_STEPS).toEqual(['10m'])
  })

  it('applies the desired retention, the fuzz and the 180-day maximum', () => {
    const { parameters } = schedulerFor(0.92)
    expect(parameters).toMatchObject({ request_retention: 0.92, maximum_interval: 180, enable_fuzz: true })
    expect(schedulerFor(0.92)).toBe(schedulerFor(0.92)) // one instance per retention
  })
})

describe('gradeCard', () => {
  it('walks a new card through the learning steps: 1 min, 6 min, 10 min', () => {
    const card = newFsrsCard(NOW)
    const due = (grade: Grade) => gradeCard(card, grade, NOW, 0.9).card
    expect(due(1)).toMatchObject({ state: 1, due: NOW + MINUTE })
    expect(due(2)).toMatchObject({ state: 1, due: NOW + 6 * MINUTE })
    expect(due(3)).toMatchObject({ state: 1, due: NOW + 10 * MINUTE })
    expect(due(4).state).toBe(2) // Easy graduates at once
  })

  it('graduates a learning card to review with Good after the last step, and sends a lapse to relearning', () => {
    const first = gradeCard(newFsrsCard(NOW), 3, NOW, 0.9).card
    const second = gradeCard(first, 3, first.due, 0.9).card
    expect(second.state).toBe(2)
    const lapse = gradeCard(second, 1, second.due, 0.9).card
    expect(lapse).toMatchObject({ state: 3, lapses: 1 })
    expect(lapse.due - second.due).toBe(10 * MINUTE)
  })

  it('keeps the review log of the library with its state before the answer (used to count new cards)', () => {
    const { log } = gradeCard(newFsrsCard(NOW), 3, NOW, 0.9)
    expect(log).toMatchObject({ rating: 3, state: 0, review: NOW })
  })

  it('never schedules a word further away than 180 days, however many times it is answered Easy', () => {
    let card: FsrsCard = newFsrsCard(NOW)
    let when = NOW
    for (let i = 0; i < 25; i += 1) {
      card = gradeCard(card, 4, when, 0.9).card
      expect(card.scheduled_days).toBeLessThanOrEqual(MAX_INTERVAL_DAYS)
      expect(card.due - when).toBeLessThanOrEqual(MAX_INTERVAL_DAYS * DAY)
      when = card.due
    }
    // Well known words do come back: the last interval is the cap itself, not years.
    expect(card.due - (card.last_review ?? 0)).toBeGreaterThan(150 * DAY)
    expect(card.stability).toBeGreaterThan(MAX_INTERVAL_DAYS) // the memory model keeps growing; only the calendar is capped
  })

  it('also caps the interval shown under the buttons', () => {
    let card: FsrsCard = newFsrsCard(NOW)
    let when = NOW
    for (let i = 0; i < 12; i += 1) {
      card = gradeCard(card, 4, when, 0.9).card
      when = card.due
    }
    const preview = previewGrades(card, when, 0.9)
    for (const grade of [1, 2, 3, 4] as const) expect(preview[grade].due - when).toBeLessThanOrEqual(MAX_INTERVAL_DAYS * DAY)
  })
})

describe('previewGrades', () => {
  it('gives each button an interval, growing from Again to Easy', () => {
    let card: FsrsCard = newFsrsCard(NOW)
    card = gradeCard(card, 4, NOW, 0.9).card // now a review card
    const preview = previewGrades(card, card.due, 0.9)
    expect(preview[1].label).toBe('10 min') // relearning step
    const dues = [1, 2, 3, 4].map((g) => preview[g as Grade].due)
    expect(dues).toEqual([...dues].sort((a, b) => a - b))
    expect(preview[4].due).toBeGreaterThan(preview[3].due)
    expect(preview[3].label).toMatch(/^[\d,]+ (d|meses?)$/)
  })

  it('matches what grading at the same moment really does', () => {
    const card = gradeCard(newFsrsCard(NOW), 4, NOW, 0.9).card
    const at = card.due
    const preview = previewGrades(card, at, 0.9)
    for (const grade of [1, 2, 3, 4] as const) expect(gradeCard(card, grade, at, 0.9).card.due).toBe(preview[grade].due)
  })
})

describe('formatInterval', () => {
  it.each([
    [30_000, '1 min'],
    [10 * MINUTE, '10 min'],
    [3 * 60 * MINUTE, '3 h'],
    [2 * DAY, '2 d'],
    [12 * DAY, '12 d'],
    [45 * DAY, '1,5 meses'],
    [60 * DAY, '2 meses'],
    [180 * DAY, '6 meses'],
    [400 * DAY, '1 año'],
  ])('%d ms -> %s', (ms, label) => expect(formatInterval(ms)).toBe(label))
})

describe('retrievability and serialisation', () => {
  it('is 0 for a card that has not started and falls as time passes', () => {
    expect(retrievability(newFsrsCard(NOW), NOW, 0.9)).toBe(0)
    const card = gradeCard(newFsrsCard(NOW), 4, NOW, 0.9).card
    const soon = retrievability(card, NOW + DAY, 0.9)
    const later = retrievability(card, NOW + 60 * DAY, 0.9)
    expect(soon).toBeGreaterThan(later)
    expect(soon).toBeLessThanOrEqual(1)
    expect(later).toBeGreaterThan(0)
  })

  it('converts a card to the library and back without losing anything', () => {
    const card = gradeCard(gradeCard(newFsrsCard(NOW), 3, NOW, 0.9).card, 3, NOW + 10 * MINUTE, 0.9).card
    expect(fromTsCard(toTsCard(card))).toEqual(card)
    expect(toTsCard(newFsrsCard(NOW)).last_review).toBeUndefined()
  })
})
