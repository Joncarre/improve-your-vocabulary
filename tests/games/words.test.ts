import { describe, expect, it } from 'vitest'
import { seededRng, shuffle, weightedSample } from '../../src/games/rng.ts'
import { ALL_WORDS, describeScope, gameSearch, includeNewFromParams, scopeFromParams, scopeToParams, type GameScope } from '../../src/games/scope.ts'
import { buildWords, MAX_ROUNDS, pickWords, planRounds, wordsInScope, wordWeight, weightedOrder } from '../../src/games/words.ts'
import { makeCard, makeSource, makeTopic } from '../factories.ts'
import { DAY, entryOf, NOW, pickOptions, wordOf } from './helpers.ts'

describe('random helpers', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = seededRng(7)
    const b = seededRng(7)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(seededRng(8)()).not.toBe(seededRng(7)())
  })

  it('shuffles into a permutation without touching the original', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    const result = shuffle(items, seededRng(3))
    expect([...result].sort()).toEqual(items)
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(shuffle(items, seededRng(3))).toEqual(result)
  })

  it('draws heavier items first more often, never twice the same, and honours the count', () => {
    let heavyFirst = 0
    for (let seed = 0; seed < 300; seed += 1) {
      const drawn = weightedSample(['light', 'heavy', 'other'], (item) => (item === 'heavy' ? 10 : 1), 2, seededRng(seed))
      expect(new Set(drawn).size).toBe(2)
      if (drawn[0] === 'heavy') heavyFirst += 1
    }
    expect(heavyFirst).toBeGreaterThan(200)
    expect(weightedSample(['a', 'b'], () => 0, 5, seededRng(1))).toHaveLength(2)
    expect(weightedSample(['a'], () => 1, 0, seededRng(1))).toEqual([])
  })
})

describe('buildWords', () => {
  it('keeps only words that can be played and notes which have been answered in a review', () => {
    const playable = entryOf('apple', 'noun')
    const archived = entryOf('pear', 'noun', { status: 'archived' })
    const pending = entryOf('plum', 'noun', { status: 'pending_ai', senses: [] })
    const deleted = entryOf('fig', 'noun', { deletedAt: 5 })
    const cards = [
      makeCard({ entryId: playable.id, stats: { seen: 2, correct: 2, wrong: 0, streak: 2 } }),
      makeCard({ entryId: playable.id, deletedAt: 9 }),
    ]
    const words = buildWords([playable, archived, pending, deleted], cards)
    expect(words.map((word) => word.entry.lemma)).toEqual(['apple'])
    expect(words[0]).toMatchObject({ seen: true })
    expect(words[0]?.cards).toHaveLength(1)
    expect(buildWords([playable], [makeCard({ entryId: playable.id })])[0]?.seen).toBe(false)
  })
})

describe('wordsInScope', () => {
  const topic = makeTopic()
  const source = makeSource()
  const pub = wordOf(entryOf('pint', 'noun', { topicIds: [topic.id], createdAt: 5 }))
  const show = wordOf(entryOf('plot', 'noun', { contexts: [{ id: 'c', sentence: 'x', sourceId: source.id, addedAt: 1 }], createdAt: 9 }))
  const rebel = wordOf(entryOf('stubborn', 'adjective', { isLeech: true, createdAt: 7 }))
  const fresh = wordOf(entryOf('brand', 'noun', { createdAt: 99 }), false)
  const all = [pub, show, rebel, fresh]

  it('uses only the words seen in a review, unless new ones are asked for', () => {
    expect(wordsInScope(all, ALL_WORDS)).toEqual([pub, show, rebel])
    expect(wordsInScope(all, ALL_WORDS, true)).toHaveLength(4)
  })

  it('narrows to a topic, a source or the rebels', () => {
    expect(wordsInScope(all, { kind: 'topic', topicId: topic.id })).toEqual([pub])
    expect(wordsInScope(all, { kind: 'source', sourceId: source.id })).toEqual([show])
    expect(wordsInScope(all, { kind: 'leeches' })).toEqual([rebel])
  })

  it('takes the newest of the playable words for "Últimas añadidas"', () => {
    const many = Array.from({ length: 30 }, (_, i) => wordOf(entryOf(`word${i}`, 'noun', { createdAt: 1000 + i })))
    const recent = wordsInScope(many, { kind: 'recent' })
    expect(recent).toHaveLength(20)
    expect(recent.every((word) => word.entry.createdAt >= 1010)).toBe(true)
    // The newest seen words, not the unseen one that was added last.
    expect(wordsInScope(all, { kind: 'recent' }).map((word) => word.entry.lemma)).not.toContain('brand')
  })

  it('keeps the failed words in a focus list even when they were never seen, and the seen ones around them', () => {
    const words = wordsInScope(all, { kind: 'focus', entryIds: [fresh.entry.id] })
    expect(words.map((word) => word.entry.lemma).sort()).toEqual(['brand', 'pint', 'plot', 'stubborn'])
  })
})

describe('scope in the address', () => {
  const scopes: GameScope[] = [
    ALL_WORDS,
    { kind: 'topic', topicId: 't-1' },
    { kind: 'source', sourceId: 's-1' },
    { kind: 'leeches' },
    { kind: 'recent' },
    { kind: 'focus', entryIds: ['a', 'b'] },
  ]

  it.each(scopes)('survives the round trip: %j', (scope) => {
    expect(scopeFromParams(scopeToParams(scope))).toEqual(scope)
  })

  it('falls back to every word when the address is incomplete or unknown', () => {
    expect(scopeFromParams(new URLSearchParams('scope=topic'))).toEqual(ALL_WORDS)
    expect(scopeFromParams(new URLSearchParams('scope=focus'))).toEqual(ALL_WORDS)
    expect(scopeFromParams(new URLSearchParams('scope=nonsense'))).toEqual(ALL_WORDS)
  })

  it('builds the search of a link, with the new-words switch', () => {
    expect(gameSearch(ALL_WORDS)).toBe('')
    expect(gameSearch({ kind: 'leeches' })).toBe('?scope=leeches')
    expect(gameSearch({ kind: 'source', sourceId: 's' }, true)).toBe('?scope=source&id=s&new=1')
    expect(includeNewFromParams(new URLSearchParams('new=1'))).toBe(true)
    expect(includeNewFromParams(new URLSearchParams(''))).toBe(false)
  })

  it('describes the scope in Spanish', () => {
    const topic = makeTopic({ nameEs: 'En el pub' })
    const source = makeSource({ title: 'Derry Girls' })
    expect(describeScope({ kind: 'topic', topicId: topic.id }, [topic], [source])).toBe('Tema: En el pub')
    expect(describeScope({ kind: 'source', sourceId: source.id }, [topic], [source])).toBe('Fuente: Derry Girls')
    expect(describeScope({ kind: 'topic', topicId: 'gone' }, [], [])).toBe('Tema: borrado')
  })
})

describe('wordWeight', () => {
  const base = (lastReview: number) =>
    makeCard({
      fsrs: { due: NOW, stability: 10, difficulty: 5, elapsed_days: 0, scheduled_days: 10, learning_steps: 0, reps: 5, lapses: 0, state: 2, last_review: lastReview },
    })
  const old = entryOf('old', 'noun', { createdAt: NOW - 90 * DAY })
  const context = { now: NOW, desiredRetention: 0.9, failedAt: new Map<string, number>() }

  it('gives more weight to a word that is about to be forgotten than to one just reviewed', () => {
    const forgotten = { ...wordOf(old), cards: [base(NOW - 40 * DAY)] }
    const fresh = { ...wordOf(old), cards: [base(NOW - 1 * DAY)] }
    expect(wordWeight(forgotten, context)).toBeGreaterThan(wordWeight(fresh, context))
  })

  it('adds weight for a recent failure, a word added this week and a rebel, and not for an old failure', () => {
    const word = { ...wordOf(old), cards: [base(NOW - 1 * DAY)] }
    const plain = wordWeight(word, context)
    expect(wordWeight(word, { ...context, failedAt: new Map([[old.id, NOW - 2 * DAY]]) })).toBeGreaterThan(plain)
    expect(wordWeight(word, { ...context, failedAt: new Map([[old.id, NOW - 20 * DAY]]) })).toBe(plain)
    expect(wordWeight({ ...word, entry: { ...old, createdAt: NOW - DAY } }, context)).toBeGreaterThan(plain)
    expect(wordWeight({ ...word, entry: { ...old, isLeech: true } }, context)).toBeGreaterThan(plain)
  })

  it('is never below 1', () => {
    expect(wordWeight({ ...wordOf(old), cards: [base(NOW)] }, context)).toBeGreaterThanOrEqual(1)
    expect(wordWeight({ ...wordOf(old), cards: [] }, context)).toBeGreaterThanOrEqual(1)
  })
})

describe('pickWords and planRounds', () => {
  const words = Array.from({ length: 30 }, (_, i) => wordOf(entryOf(`w${i}`, 'noun')))

  it('picks the number asked for, all different, and is repeatable with the same seed', () => {
    const picked = pickWords(words, 10, pickOptions({ rng: seededRng(5) }))
    expect(picked).toHaveLength(10)
    expect(new Set(picked.map((word) => word.entry.id)).size).toBe(10)
    expect(pickWords(words, 10, pickOptions({ rng: seededRng(5) })).map((w) => w.entry.id)).toEqual(picked.map((w) => w.entry.id))
  })

  it('returns every word when there are fewer than asked for', () => {
    expect(pickWords(words.slice(0, 4), 10, pickOptions())).toHaveLength(4)
  })

  it('puts the focus words in first and fills the rest from the others', () => {
    const focusIds = new Set(words.slice(0, 3).map((word) => word.entry.id))
    for (let seed = 0; seed < 20; seed += 1) {
      const ids = pickWords(words, 5, pickOptions({ rng: seededRng(seed), focusIds })).map((word) => word.entry.id)
      expect([...focusIds].every((id) => ids.includes(id))).toBe(true)
      expect(ids).toHaveLength(5)
    }
    expect(weightedOrder(words, pickOptions({ focusIds })).slice(0, 3).every((word) => focusIds.has(word.entry.id))).toBe(true)
  })

  it('leans towards words with more weight (a boost, a recent failure)', () => {
    const target = words[0] as (typeof words)[number]
    let hits = 0
    for (let seed = 0; seed < 200; seed += 1) {
      const picked = pickWords(words, 3, pickOptions({ rng: seededRng(seed), boost: (word) => (word === target ? 20 : 1) }))
      if (picked.includes(target)) hits += 1
    }
    // Three of thirty by chance is 10 %; with the boost it is far above that.
    expect(hits).toBeGreaterThan(120)
  })

  it('builds at most ten rounds and skips the words that cannot make one', () => {
    const rounds = planRounds(words, MAX_ROUNDS, pickOptions(), (word) => (word.entry.lemma === 'w1' ? null : word.entry.lemma))
    expect(rounds).toHaveLength(10)
    expect(rounds).not.toContain('w1')
    expect(planRounds(words.slice(0, 3), MAX_ROUNDS, pickOptions(), (word) => word.entry.lemma)).toHaveLength(3)
  })
})
