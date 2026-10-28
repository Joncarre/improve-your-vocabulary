import { describe, expect, it } from 'vitest'
import { generateSeedData } from '../../../src/dev/seed.ts'
import {
  countByStatus,
  groupRows,
  matchesStatus,
  sortRows,
  STATUS_FILTERS,
  type StatusFilter,
} from '../../../src/features/library/filters.ts'
import { buildRows, type LibraryRow } from '../../../src/features/library/model.ts'
import { buildSearchIndex, searchEntries } from '../../../src/features/library/search.ts'
import { normalizeSearch, searchTokens } from '../../../src/lib/searchText.ts'
import type { Entry } from '../../../src/shared/index.ts'
import { makeCard, makeEntry, makeTopic } from '../../factories.ts'

const sense = (meaningEs: string, extra: Partial<Entry['senses'][number]> = {}) => ({
  ...(makeEntry().senses[0] as Entry['senses'][number]),
  id: `s-${meaningEs}`,
  meaningEs,
  examples: [],
  ...extra,
})

const fsrs = (state: number, stability = 0) => ({
  ...makeCard().fsrs,
  state,
  stability,
})

function entry(lemma: string, overrides: Partial<Entry> = {}): Entry {
  return makeEntry({ id: `e-${lemma}`, lemma, lemmaKey: lemma.toLowerCase(), seenForm: undefined, ...overrides })
}

describe('normalizeSearch', () => {
  it('ignores case, accents, apostrophes and extra spaces', () => {
    expect(normalizeSearch('  Camión  ')).toBe('camion')
    expect(normalizeSearch("Don’t")).toBe('dont')
    expect(normalizeSearch('  GIVE   up ')).toBe('give up')
    expect(searchTokens('')).toEqual([])
    expect(searchTokens('  Give  Up ')).toEqual(['give', 'up'])
  })
})

describe('searchEntries', () => {
  const go = entry('go', {
    seenForm: 'went',
    senses: [sense('ir')],
    forms: { verb: { base: 'go', thirdPerson: 'goes', pastSimple: ['went'], pastParticiple: ['gone'], presentParticiple: 'going', irregular: true } },
    synonyms: ['travel'],
    contexts: [{ id: 'c1', sentence: 'We went to the pub after work.', addedAt: 1, sourceId: 's1' }],
    topicIds: ['t1'],
  })
  const lorry = entry('lorry', { senses: [sense('camión', { definitionEn: 'a large vehicle' })] })
  const giveUp = entry('give up', { senses: [sense('rendirse')] })
  const index = buildSearchIndex([go, lorry, giveUp], {
    topics: [makeTopic({ id: 't1', nameEs: 'En el pub' })],
    sources: [{ id: 's1', title: 'Peaky Blinders', type: 'series', lastUsedAt: 1, updatedAt: 1 }],
  })
  const ids = (query: string) => [...(searchEntries(index, query) ?? new Map()).keys()]

  it('has no filter without a query', () => {
    expect(searchEntries(index, '')).toBeNull()
    expect(searchEntries(index, '   ')).toBeNull()
  })

  it('finds a word in English, by a form you typed, and in Spanish without accents', () => {
    expect(ids('lorry')).toEqual([lorry.id])
    expect(ids('went')).toEqual([go.id]) // the form that was typed
    expect(ids('camion')).toEqual([lorry.id]) // camión
    expect(ids('RENDIRSE')).toEqual([giveUp.id])
  })

  it('finds by definition, by the sentence where it was seen, by topic and by series', () => {
    expect(ids('vehicle')).toEqual([lorry.id])
    expect(ids('after work')).toEqual([go.id])
    expect(ids('pub')).toEqual([go.id])
    expect(ids('peaky')).toEqual([go.id])
  })

  it('needs every word of the query to match', () => {
    expect(ids('give up')).toEqual([giveUp.id])
    expect(ids('give camion')).toEqual([])
    expect(ids('zzz')).toEqual([])
  })

  it('ranks the word itself above its forms, its meaning and the rest', () => {
    const rank = (text: string) => searchEntries(index, text)?.get(go.id) ?? 0
    expect(rank('go')).toBeGreaterThan(rank('went')) // lemma > form
    expect(rank('went')).toBeGreaterThan(rank('ir')) // form > meaning
    expect(rank('ir')).toBeGreaterThan(rank('travel')) // meaning > everything else
    const both = buildSearchIndex([entry('trip', { senses: [sense('viaje')] }), entry('tripod', { senses: [sense('trípode')] })])
    const scores = searchEntries(both, 'trip')
    expect(scores?.get('e-trip')).toBeGreaterThan(scores?.get('e-tripod') ?? 0) // exact > prefix
  })
})

describe('library rows, filters, sort and groups', () => {
  const topics = [makeTopic({ id: 'pub', nameEs: 'En el pub', emoji: '🍺' }), makeTopic({ id: 'work', nameEs: 'Trabajo', emoji: '💼' })]
  const sources = [
    { id: 's1', title: 'Peaky Blinders', type: 'series' as const, lastUsedAt: 1, updatedAt: 1 },
    { id: 's2', title: 'Derry Girls', type: 'series' as const, lastUsedAt: 1, updatedAt: 1 },
  ]

  const fresh = entry('apple', { createdAt: 10, senses: [sense('manzana', { pos: 'noun' })] })
  const learning = entry('bring', { createdAt: 20, senses: [sense('traer', { pos: 'verb' })], topicIds: ['pub'], contexts: [{ id: 'c', sentence: 'x', addedAt: 1, sourceId: 's1' }] })
  const mastered = entry('cheers', { createdAt: 30, senses: [sense('gracias', { pos: 'noun' })], topicIds: ['pub', 'work'], contexts: [{ id: 'c', sentence: 'x', addedAt: 1, sourceId: 's2' }] })
  const leech = entry('dodgy', { createdAt: 40, senses: [sense('sospechoso', { pos: 'adjective' })], isLeech: true })
  const pending = entry('eh', { createdAt: 50, status: 'pending_ai', senses: [] })
  const archived = entry('fine', { createdAt: 60, status: 'archived', senses: [sense('bien', { pos: 'adverb' })] })
  const entries = [fresh, learning, mastered, leech, pending, archived]

  const cards = [
    makeCard({ entryId: learning.id, fsrs: fsrs(1), due: 500, stats: { seen: 3, correct: 1, wrong: 2, streak: 0 } }),
    makeCard({ entryId: mastered.id, fsrs: fsrs(2, 90), due: 9_000, stats: { seen: 12, correct: 12, wrong: 0, streak: 8 } }),
    makeCard({ entryId: leech.id, fsrs: fsrs(2, 5), due: 100, stats: { seen: 9, correct: 3, wrong: 6, streak: 0 } }),
    makeCard({ entryId: fresh.id }),
  ]
  const rows = buildRows(entries, cards)
  const lemmas = (list: readonly LibraryRow[]) => list.map((row) => row.entry.lemma)

  it('derives the state, the wrong answers and the next review of each entry', () => {
    const byLemma = new Map(rows.map((row) => [row.entry.lemma, row]))
    expect(byLemma.get('apple')).toMatchObject({ state: 'new', wrong: 0, nextDue: null, pos: 'noun' })
    expect(byLemma.get('bring')).toMatchObject({ state: 'learning', wrong: 2, nextDue: 500 })
    expect(byLemma.get('cheers')).toMatchObject({ state: 'mastered', wrong: 0, nextDue: 9_000 })
    expect(byLemma.get('cheers')?.sourceIds).toEqual(['s2'])
    expect(byLemma.get('eh')).toMatchObject({ state: 'new', pos: undefined })
  })

  it('"Todas" leaves out the archived; every other filter narrows it down', () => {
    const only = (filter: StatusFilter) => lemmas(rows.filter((row) => matchesStatus(row, filter)))
    expect(only('all')).toEqual(['apple', 'bring', 'cheers', 'dodgy', 'eh'])
    expect(only('new')).toEqual(['apple'])
    expect(only('learning')).toEqual(['bring'])
    expect(only('mastered')).toEqual(['cheers'])
    expect(only('leech')).toEqual(['dodgy'])
    expect(only('pending')).toEqual(['eh'])
    expect(only('archived')).toEqual(['fine'])
  })

  it('does not call a pending entry "new" and does not mix archived ones into the states', () => {
    expect(rows.filter((row) => matchesStatus(row, 'new')).some((row) => row.entry.status !== 'active')).toBe(false)
  })

  it('counts every filter', () => {
    const counts = countByStatus(rows)
    expect(counts.all).toBe(5)
    expect(counts.archived).toBe(1)
    expect(counts.leech).toBe(1)
    expect(Object.keys(counts).sort()).toEqual(STATUS_FILTERS.map((f) => f.value).sort())
  })

  it('sorts by recent, alphabet, most failed and next review, without touching the input', () => {
    const before = lemmas(rows)
    expect(lemmas(sortRows(rows, 'recent'))).toEqual(['fine', 'eh', 'dodgy', 'cheers', 'bring', 'apple'])
    expect(lemmas(sortRows(rows, 'alpha'))).toEqual(['apple', 'bring', 'cheers', 'dodgy', 'eh', 'fine'])
    expect(lemmas(sortRows(rows, 'wrong')).slice(0, 2)).toEqual(['dodgy', 'bring']) // 6 and 2 wrong answers
    // soonest due first (dodgy 100, bring 500, cheers 9000); not started ones last, newest first
    expect(lemmas(sortRows(rows, 'due'))).toEqual(['dodgy', 'bring', 'cheers', 'fine', 'eh', 'apple'])
    expect(lemmas(rows)).toEqual(before)
  })

  it('groups by topic (a word with two topics appears twice), "Sin tema" last', () => {
    const groups = groupRows(sortRows(rows, 'alpha'), 'topic', { topics, sources })
    expect(groups.map((g) => g.title)).toEqual(['En el pub', 'Trabajo', 'Sin tema'])
    expect(groups.map((g) => lemmas(g.rows))).toEqual([['bring', 'cheers'], ['cheers'], ['apple', 'dodgy', 'eh', 'fine']])
    expect(groups[0]?.emoji).toBe('🍺')
  })

  it('groups by series or film, each with the link to its page', () => {
    const groups = groupRows(sortRows(rows, 'alpha'), 'source', { topics, sources })
    expect(groups.map((g) => g.title)).toEqual(['Derry Girls', 'Peaky Blinders', 'Sin fuente'])
    expect(groups[0]?.href).toBe('/source/s2')
    expect(groups.at(-1)?.href).toBeUndefined()
  })

  it('groups by word type in a fixed order, with "Sin tipo" last', () => {
    const groups = groupRows(sortRows(rows, 'alpha'), 'pos', { topics, sources })
    expect(groups.map((g) => g.title)).toEqual(['Sustantivo', 'Verbo', 'Adjetivo', 'Adverbio', 'Sin tipo'])
    expect(lemmas(groups[0]?.rows ?? [])).toEqual(['apple', 'cheers'])
  })

  it('has one group for the plain view', () => {
    expect(groupRows(rows, 'all', { topics, sources })).toHaveLength(1)
  })
})

describe('with the 1,000 test words', () => {
  const { entries, cards, topics, sources } = generateSeedData(1000, 1_000_000_000_000)

  const time = (work: () => void) => {
    const start = performance.now()
    work()
    return performance.now() - start
  }

  it('generates a varied collection', () => {
    expect(entries).toHaveLength(1000)
    const rows = buildRows(entries, cards)
    const counts = countByStatus(rows)
    for (const key of ['new', 'learning', 'review', 'consolidated', 'mastered', 'leech', 'pending', 'archived'] as const) {
      expect(counts[key], key).toBeGreaterThan(0)
    }
    expect(new Set(entries.map((e) => e.lemmaKey)).size).toBe(1000)
  })

  it('builds the index and answers searches instantly (measured)', () => {
    let index = buildSearchIndex(entries, { topics, sources })
    const build = time(() => {
      index = buildSearchIndex(entries, { topics, sources })
    })
    const queries = ['g', 'give', 'give up', 'turn o', 'caminar', 'derry girls', 'zzzz', 'lo']
    const worst = Math.max(...queries.map((query) => time(() => searchEntries(index, query))))
    const rowsTime = time(() => buildRows(entries, cards))
    const sorted = time(() => sortRows(buildRows(entries, cards), 'due'))
    console.log(`1,000 words: index ${build.toFixed(1)} ms · slowest search ${worst.toFixed(2)} ms · rows ${rowsTime.toFixed(1)} ms · rows+sort ${sorted.toFixed(1)} ms`)
    expect(worst).toBeLessThan(20)
    expect(build).toBeLessThan(200)
  })

  it('finds a phrasal verb by its verb, its particle or its Spanish meaning', () => {
    const index = buildSearchIndex(entries, { topics, sources })
    expect(searchEntries(index, 'give up')?.has('seed-0000')).toBe(true)
    // "walk" with its 25 particles, minus the entries still waiting for the AI (they have no meaning yet)
    expect(searchEntries(index, 'caminar')?.size).toBeGreaterThanOrEqual(20)
  })
})
