import { describe, expect, it } from 'vitest'
import { cardState, entryState, isActiveCard } from '../../src/srs/state.ts'
import { makeCard } from '../factories.ts'

const card = (fsrs: Partial<ReturnType<typeof makeCard>['fsrs']>, stats: Partial<ReturnType<typeof makeCard>['stats']> = {}, extra = {}) => {
  const base = makeCard()
  return makeCard({ fsrs: { ...base.fsrs, ...fsrs }, stats: { ...base.stats, ...stats }, ...extra })
}

describe('cardState (spec §7)', () => {
  it('is "new" for a card never reviewed', () => {
    expect(cardState(card({ state: 0 }))).toBe('new')
  })

  it.each([
    [1, 'Learning'],
    [3, 'Relearning'],
  ])('is "learning" in FSRS state %i (%s)', (state) => {
    expect(cardState(card({ state }))).toBe('learning')
  })

  it('is "review" while stability is below 21 days', () => {
    expect(cardState(card({ state: 2, stability: 20.9 }))).toBe('review')
  })

  it('is "consolidated" from 21 days of stability', () => {
    expect(cardState(card({ state: 2, stability: 21 }))).toBe('consolidated')
    expect(cardState(card({ state: 2, stability: 59.9 }, { streak: 9 }))).toBe('consolidated')
  })

  it('is "mastered" only with 60 days of stability and a streak of 5', () => {
    expect(cardState(card({ state: 2, stability: 60 }, { streak: 5 }))).toBe('mastered')
    expect(cardState(card({ state: 2, stability: 90 }, { streak: 4 }))).toBe('consolidated')
    expect(cardState(card({ state: 2, stability: 59 }, { streak: 8 }))).toBe('consolidated')
  })
})

describe('entryState', () => {
  const recognition = (fsrs: Parameters<typeof card>[0], stats: Parameters<typeof card>[1] = {}) =>
    card(fsrs, stats, { type: 'recognition', unlocked: true })
  const production = (fsrs: Parameters<typeof card>[0], extra = {}) =>
    card(fsrs, {}, { type: 'production', unlocked: true, ...extra })

  it('is the state of the weakest active card', () => {
    const cards = [recognition({ state: 2, stability: 80 }, { streak: 6 }), production({ state: 1 })]
    expect(entryState(cards)).toBe('learning')
  })

  it('ignores the production card while it is locked, suspended or deleted', () => {
    const strong = recognition({ state: 2, stability: 30 })
    expect(entryState([strong, production({ state: 0 }, { unlocked: false })])).toBe('consolidated')
    expect(entryState([strong, production({ state: 0 }, { suspended: true })])).toBe('consolidated')
    expect(entryState([strong, production({ state: 0 }, { deletedAt: 5 })])).toBe('consolidated')
  })

  it('is "new" without any active card', () => {
    expect(entryState([])).toBe('new')
    expect(entryState([production({ state: 2, stability: 99 }, { unlocked: false })])).toBe('new')
  })
})

describe('isActiveCard', () => {
  it('needs an unlocked card that is neither suspended nor deleted', () => {
    expect(isActiveCard(makeCard())).toBe(true)
    expect(isActiveCard(makeCard({ unlocked: false }))).toBe(false)
    expect(isActiveCard(makeCard({ suspended: true }))).toBe(false)
    expect(isActiveCard(makeCard({ deletedAt: 1 }))).toBe(false)
  })
})
