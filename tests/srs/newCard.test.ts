import { describe, expect, it } from 'vitest'
import { FsrsCardSchema } from '../../src/shared/index.ts'
import { newFsrsCard } from '../../src/srs/newCard.ts'

describe('newFsrsCard', () => {
  it('is a new card due now, in the shape that is stored', () => {
    const card = newFsrsCard(1_700_000_000_000)

    expect(FsrsCardSchema.safeParse(card).success).toBe(true)
    expect(card).toMatchObject({ due: 1_700_000_000_000, state: 0, reps: 0, lapses: 0, stability: 0, difficulty: 0 })
    expect(card.last_review).toBeUndefined()
  })
})
