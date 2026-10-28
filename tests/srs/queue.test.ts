import { describe, expect, it } from 'vitest'
import {
  areNearSynonyms,
  BACKLOG_END,
  BACKLOG_START,
  buildExtraQueue,
  buildQueue,
  nextBacklogMode,
  type QueueInput,
} from '../../src/srs/queue.ts'
import { newFsrsCard } from '../../src/srs/newCard.ts'
import type { Card, Entry, FsrsCard } from '../../src/shared/index.ts'
import { makeCard, makeEntry } from '../factories.ts'

const NOW = new Date(2026, 5, 10, 12, 0).getTime() // 10 June 2026, noon, in local time
const MINUTE = 60_000
const DAY = 86_400_000
const DAY_END = new Date(2026, 5, 11, 4, 0).getTime()

let counter = 0
const entry = (lemma: string, extra: Partial<Entry> = {}): Entry => {
  counter += 1
  return makeEntry({ id: `e-${lemma}`, lemma, lemmaKey: lemma, createdAt: counter, senses: [{ ...makeEntry().senses[0]!, id: `s-${lemma}`, meaningEs: `significado de ${lemma}` }], ...extra })
}

const fsrs = (state: 0 | 1 | 2 | 3, due: number, extra: Partial<FsrsCard> = {}): FsrsCard => ({
  ...newFsrsCard(NOW),
  state,
  due,
  stability: state === 2 ? 10 : 0,
  last_review: state === 0 ? undefined : NOW - 5 * DAY,
  ...extra,
})

const card = (e: Entry, state: 0 | 1 | 2 | 3, due: number, extra: Omit<Partial<Card>, 'fsrs'> & { fsrs?: Partial<FsrsCard> } = {}): Card => {
  const { fsrs: fsrsExtra, ...rest } = extra
  return makeCard({ id: `c-${e.id}-${rest.type ?? 'recognition'}`, entryId: e.id, due, fsrs: fsrs(state, due, fsrsExtra), ...rest })
}

const input = (overrides: Partial<QueueInput>): QueueInput => ({
  entries: [],
  cards: [],
  now: NOW,
  dayStartHour: 4,
  newPerDay: 10,
  productionEnabled: true,
  desiredRetention: 0.9,
  backlogMode: false,
  newStartedToday: 0,
  newTodayEntryIds: new Set(),
  answeredToday: new Map(),
  ...overrides,
})

const ids = (result: ReturnType<typeof buildQueue>) => result.items.map((item) => `${item.kind}:${item.entry.lemma}`)

describe('which cards enter', () => {
  it('takes reviews due today (even later today), but not tomorrow', () => {
    const a = entry('a'), b = entry('b'), c = entry('c')
    const result = buildQueue(input({ entries: [a, b, c], cards: [card(a, 2, NOW - DAY), card(b, 2, DAY_END - MINUTE), card(c, 2, DAY_END + MINUTE)] }))
    expect(ids(result).sort()).toEqual(['review:a', 'review:b'])
  })

  it('takes learning cards when they are due and those due within 15 minutes, last', () => {
    const due = entry('due'), soon = entry('soon'), later = entry('later'), review = entry('review')
    const result = buildQueue(
      input({
        entries: [due, soon, later, review],
        cards: [card(soon, 1, NOW + 10 * MINUTE), card(later, 3, NOW + 40 * MINUTE), card(due, 1, NOW - MINUTE), card(review, 2, NOW - DAY)],
      }),
    )
    expect(ids(result)).toEqual(['learning:due', 'review:review', 'learning:soon'])
  })

  it('leaves out archived, pending and deleted words, locked or suspended cards and cards of words without senses', () => {
    const ok = entry('ok'), archived = entry('archived', { status: 'archived' }), pending = entry('pending', { status: 'pending_ai' })
    const gone = entry('gone', { deletedAt: 5 }), empty = entry('empty', { senses: [] })
    const locked = entry('locked'), suspended = entry('suspended')
    const result = buildQueue(
      input({
        entries: [ok, archived, pending, gone, empty, locked, suspended],
        cards: [ok, archived, pending, gone, empty].map((e) => card(e, 2, NOW - DAY)).concat([card(locked, 2, NOW - DAY, { unlocked: false }), card(suspended, 2, NOW - DAY, { suspended: true })]),
      }),
    )
    expect(ids(result)).toEqual(['review:ok'])
  })

  it('drops the written cards when they are switched off, without touching the recognition ones', () => {
    const a = entry('a'), b = entry('b')
    const cards = [card(a, 2, NOW - DAY), card(b, 2, NOW - DAY, { type: 'production' })]
    expect(ids(buildQueue(input({ entries: [a, b], cards, productionEnabled: false })))).toEqual(['review:a'])
    expect(ids(buildQueue(input({ entries: [a, b], cards, productionEnabled: true })))).toHaveLength(2)
  })
})

describe('order', () => {
  it('shows first the review that is closest to being forgotten', () => {
    const fresh = entry('fresh'), stale = entry('stale'), middle = entry('middle')
    const result = buildQueue(
      input({
        entries: [fresh, stale, middle],
        cards: [
          card(fresh, 2, NOW - DAY, { fsrs: { last_review: NOW - 2 * DAY, stability: 30 } }),
          card(stale, 2, NOW - DAY, { fsrs: { last_review: NOW - 60 * DAY, stability: 8 } }),
          card(middle, 2, NOW - DAY, { fsrs: { last_review: NOW - 10 * DAY, stability: 12 } }),
        ],
      }),
    )
    expect(ids(result)).toEqual(['review:stale', 'review:middle', 'review:fresh'])
  })

  it('brings one new card after every four reviews, and the rest at the end', () => {
    const reviewed = Array.from({ length: 9 }, (_, i) => entry(`r${i}`))
    const fresh = ['n1', 'n2', 'n3'].map((lemma) => entry(lemma))
    const result = buildQueue(
      input({
        entries: [...reviewed, ...fresh],
        cards: [...reviewed.map((e, i) => card(e, 2, NOW - DAY, { fsrs: { last_review: NOW - (30 - i) * DAY } })), ...fresh.map((e) => card(e, 0, NOW))],
      }),
    )
    expect(result.items.map((item) => item.kind[0]).join('')).toBe('rrrrnrrrrnrn')
    expect(result.counts).toEqual({ learning: 0, review: 9, new: 3 })
  })

  it('introduces the oldest words first', () => {
    const second = entry('second'), first = entry('first', { createdAt: 0 })
    expect(ids(buildQueue(input({ entries: [second, first], cards: [card(second, 0, NOW), card(first, 0, NOW)] })))).toEqual(['new:first', 'new:second'])
  })
})

describe('new cards', () => {
  it('stops at the daily limit, counting those already started today', () => {
    const words = ['a', 'b', 'c', 'd'].map((lemma) => entry(lemma))
    const cards = words.map((e) => card(e, 0, NOW))
    expect(buildQueue(input({ entries: words, cards, newPerDay: 3 })).counts.new).toBe(3)
    expect(buildQueue(input({ entries: words, cards, newPerDay: 3, newStartedToday: 2 })).counts.new).toBe(1)
    expect(buildQueue(input({ entries: words, cards, newPerDay: 3, newStartedToday: 5 })).counts.new).toBe(0)
    expect(buildQueue(input({ entries: words, cards, newPerDay: 0 })).counts.new).toBe(0)
  })

  it('does not offer a new card that is not due yet (a production card unlocked for tomorrow)', () => {
    const a = entry('a')
    expect(buildQueue(input({ entries: [a], cards: [card(a, 0, DAY_END, { type: 'production' })] })).items).toEqual([])
    expect(buildQueue(input({ entries: [a], cards: [card(a, 0, NOW, { type: 'production' })] })).items).toHaveLength(1)
  })

  it('keeps near-synonyms apart: the same day only one of two is introduced', () => {
    const big = entry('big', { synonyms: ['large'] }), large = entry('large'), tiny = entry('tiny')
    const result = buildQueue(input({ entries: [big, large, tiny], cards: [big, large, tiny].map((e) => card(e, 0, NOW)) }))
    expect(ids(result).sort()).toEqual(['new:big', 'new:tiny'])
  })

  it('also keeps apart a word and one introduced earlier today', () => {
    const big = entry('big', { synonyms: ['large'] }), large = entry('large')
    const result = buildQueue(input({ entries: [big, large], cards: [card(large, 0, NOW)], newTodayEntryIds: new Set([big.id]) }))
    expect(result.items).toEqual([])
  })

  it('recognises near-synonyms by synonyms, antonyms and an identical first meaning', () => {
    const hot = entry('hot', { antonyms: ['cold'] }), cold = entry('cold')
    expect(areNearSynonyms(hot, cold)).toBe(true)
    expect(areNearSynonyms(cold, hot)).toBe(true)
    const a = entry('rapid', { senses: [{ ...makeEntry().senses[0]!, meaningEs: 'Rápido' }] })
    const b = entry('quick', { senses: [{ ...makeEntry().senses[0]!, meaningEs: 'rapido' }] })
    expect(areNearSynonyms(a, b)).toBe(true)
    expect(areNearSynonyms(a, entry('slow'))).toBe(false)
    expect(areNearSynonyms(a, a)).toBe(false)
  })
})

describe('siblings (a word never has both cards on the same day)', () => {
  it('offers only one of the two cards when both are due, preferring the review', () => {
    const a = entry('a')
    const result = buildQueue(input({ entries: [a], cards: [card(a, 2, NOW - DAY), card(a, 0, NOW, { type: 'production' })] }))
    expect(result.items.map((item) => [item.kind, item.card.type])).toEqual([['review', 'recognition']])
  })

  it('leaves the sibling for tomorrow once one card has been answered today', () => {
    const a = entry('a')
    const recognition = card(a, 1, NOW + MINUTE)
    const production = card(a, 2, NOW - DAY, { type: 'production' })
    const answered = new Map([[a.id, new Set([recognition.id])]])
    const result = buildQueue(input({ entries: [a], cards: [recognition, production], answeredToday: answered }))
    // the card that was answered may come back (learning step); its sibling may not
    expect(result.items.map((item) => item.card.id)).toEqual([recognition.id])
  })
})

describe('backlog', () => {
  const pile = (count: number) => {
    const words = Array.from({ length: count }, (_, i) => entry(`w${i}`))
    return { words, cards: words.map((e) => card(e, 2, NOW - DAY)) }
  }

  it('starts above 150 reviews due and only ends below 50 (two thresholds)', () => {
    expect(BACKLOG_START).toBe(150)
    expect(BACKLOG_END).toBe(50)
    expect(nextBacklogMode(false, 150)).toBe(false)
    expect(nextBacklogMode(false, 151)).toBe(true)
    expect(nextBacklogMode(true, 100)).toBe(true)
    expect(nextBacklogMode(true, 50)).toBe(true)
    expect(nextBacklogMode(true, 49)).toBe(false)
  })

  it('holds back new cards and keeps the most urgent reviews first', () => {
    const { words, cards } = pile(160)
    const fresh = entry('fresh')
    const result = buildQueue(input({ entries: [...words, fresh], cards: [...cards, card(fresh, 0, NOW)] }))
    expect(result.backlogMode).toBe(true)
    expect(result.newBlocked).toBe(true)
    expect(result.counts.new).toBe(0)
    expect(result.counts.review).toBe(160)
  })

  it('keeps holding them while the pile is between 50 and 150, and lets them in below 50', () => {
    const middle = pile(100)
    const fresh = entry('fresh')
    const during = buildQueue(input({ entries: [...middle.words, fresh], cards: [...middle.cards, card(fresh, 0, NOW)], backlogMode: true }))
    expect(during.counts.new).toBe(0)
    const small = pile(49)
    const after = buildQueue(input({ entries: [...small.words, fresh], cards: [...small.cards, card(fresh, 0, NOW)], backlogMode: true }))
    expect(after.backlogMode).toBe(false)
    expect(after.counts.new).toBe(1)
  })

  it('does not treat 100 reviews as a backlog when it has not started', () => {
    const { words, cards } = pile(100)
    const fresh = entry('fresh')
    const result = buildQueue(input({ entries: [...words, fresh], cards: [...cards, card(fresh, 0, NOW)] }))
    expect(result.backlogMode).toBe(false)
    expect(result.counts.new).toBe(1)
  })
})

describe('buildExtraQueue (Repasar esta serie)', () => {
  it('lists the recognition card of each active word, the most failed first, without looking at the calendar', () => {
    const a = entry('a'), b = entry('b'), c = entry('c', { status: 'archived' }), d = entry('d')
    const cards = [
      card(a, 2, NOW + 90 * DAY, { stats: { seen: 4, correct: 3, wrong: 1, streak: 1 } }),
      card(b, 2, NOW + 90 * DAY, { stats: { seen: 8, correct: 3, wrong: 5, streak: 0 } }),
      card(c, 2, NOW),
      card(d, 0, NOW, { type: 'production' }),
      card(d, 0, NOW),
    ]
    expect(buildExtraQueue([a, b, c, d], cards).map((item) => item.entry.lemma)).toEqual(['b', 'a', 'd'])
  })
})
