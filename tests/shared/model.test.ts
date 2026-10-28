import { describe, expect, it } from 'vitest'
import {
  CardSchema,
  EntrySchema,
  GameResultSchema,
  OutboxItemSchema,
  parseSyncRecord,
  ReviewLogSchema,
  SYNC_TABLES,
  SyncTableNameSchema,
} from '../../src/shared/index.ts'
import { makeCard, makeEntry } from '../factories.ts'

describe('EntrySchema', () => {
  it('accepts a complete entry', () => {
    expect(EntrySchema.safeParse(makeEntry()).success).toBe(true)
  })

  it('rejects unknown statuses and empty lemmas', () => {
    expect(EntrySchema.safeParse({ ...makeEntry(), status: 'deleted' }).success).toBe(false)
    expect(EntrySchema.safeParse({ ...makeEntry(), lemma: '' }).success).toBe(false)
  })

  it('accepts the pending_ai status used while waiting for the AI', () => {
    expect(EntrySchema.safeParse(makeEntry({ status: 'pending_ai' })).success).toBe(true)
  })
})

describe('CardSchema', () => {
  it('accepts a new card', () => {
    expect(CardSchema.safeParse(makeCard()).success).toBe(true)
  })

  it('defaults the deprecated elapsed_days field', () => {
    const { fsrs } = makeCard()
    const { elapsed_days: _omitted, ...withoutElapsed } = fsrs
    const parsed = CardSchema.parse({ ...makeCard(), fsrs: withoutElapsed })
    expect(parsed.fsrs.elapsed_days).toBe(0)
  })

  it('rejects an FSRS state outside 0-3', () => {
    const card = makeCard()
    expect(CardSchema.safeParse({ ...card, fsrs: { ...card.fsrs, state: 4 } }).success).toBe(false)
  })
})

describe('ReviewLogSchema', () => {
  const log = {
    id: 'l1',
    cardId: 'c1',
    entryId: 'e1',
    at: 1,
    correct: true,
    ms: 1200,
    updatedAt: 1,
  }

  it.each(['review', 'extra', 'game:match', 'game:connections'])('accepts the origin %s', (origin) => {
    expect(ReviewLogSchema.safeParse({ ...log, origin }).success).toBe(true)
  })

  it.each(['game:chess', 'game:', 'games:match', 'other'])('rejects the origin %s', (origin) => {
    expect(ReviewLogSchema.safeParse({ ...log, origin }).success).toBe(false)
  })

  it('only allows ratings 1 to 4', () => {
    expect(ReviewLogSchema.safeParse({ ...log, origin: 'review', rating: 3 }).success).toBe(true)
    expect(ReviewLogSchema.safeParse({ ...log, origin: 'review', rating: 5 }).success).toBe(false)
  })
})

describe('GameResultSchema', () => {
  const result = { id: 'g1', game: 'match', at: 1, score: 5, total: 6, durationMs: 41_000, updatedAt: 1 }

  it('accepts a result with or without the version of the game that was played', () => {
    expect(GameResultSchema.safeParse(result).success).toBe(true)
    expect(GameResultSchema.parse({ ...result, variant: 'ipa' }).variant).toBe('ipa')
  })

  it('keeps the variant through the records that travel to the server and into a backup', () => {
    const parsed = parseSyncRecord('games', { ...result, variant: 'es' })
    expect(parsed.ok && parsed.record).toMatchObject({ variant: 'es' })
  })

  it('rejects an unknown game', () => {
    expect(GameResultSchema.safeParse({ ...result, game: 'chess' }).success).toBe(false)
  })
})

describe('sync tables', () => {
  it('lists the eight synced tables and none of the local ones', () => {
    expect([...SYNC_TABLES].sort()).toEqual(
      ['cards', 'entries', 'games', 'logs', 'sharedSettings', 'sources', 'stories', 'topics'].sort(),
    )
    expect(SyncTableNameSchema.safeParse('deviceSettings').success).toBe(false)
    expect(SyncTableNameSchema.safeParse('outbox').success).toBe(false)
  })

  it('validates outbox items', () => {
    expect(OutboxItemSchema.safeParse({ table: 'entries', id: 'e1', queuedAt: 1 }).success).toBe(true)
    expect(OutboxItemSchema.safeParse({ table: 'deviceSettings', id: 'device', queuedAt: 1 }).success).toBe(false)
  })
})
