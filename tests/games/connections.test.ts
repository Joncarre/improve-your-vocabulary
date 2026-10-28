import { describe, expect, it } from 'vitest'
import {
  BOARD_WORDS,
  buildLinks,
  findQuads,
  GROUPS,
  hasConnectionsBoard,
  judgeGuess,
  PER_GROUP,
  planConnections,
  wordsWithLinks,
  type ConnectionsBoard,
  type Link,
} from '../../src/games/connections.ts'
import { seededRng } from '../../src/games/rng.ts'
import type { GameWord } from '../../src/games/words.ts'
import type { Context, Entry, PartOfSpeech } from '../../src/shared/index.ts'
import { makeSource, makeTopic } from '../factories.ts'
import { entryOf, familyOf, member, pickOptions, verbOf, wordOf } from './helpers.ts'

const topic = (id: string) => makeTopic({ id, nameEs: `Tema ${id}`, emoji: '🍺' })
const source = (id: string) => makeSource({ id, title: `Serie ${id}` })
let contexts = 0
const context = (sourceId: string): Context => {
  contexts += 1
  return { id: `c${contexts}`, sentence: 'x', addedAt: 1, sourceId }
}

/** `count` nouns of one topic, with names that cannot be mistaken for each other. */
const inTopic = (id: string, count: number, extra: Partial<Entry> = {}, prefix = id) =>
  Array.from({ length: count }, (_, i) => wordOf(entryOf(`${prefix}${i}`, 'noun', { topicIds: [id], ...extra })))

/** The link of a group checked against the data of the word itself, without going through the `members` sets the generator used. */
function fits(link: Link, entry: Entry): boolean {
  const key = link.id.slice(link.kind.length + 1)
  switch (link.kind) {
    case 'topic':
      return entry.topicIds.includes(key)
    case 'source':
      return entry.contexts.some((c) => c.sourceId === key)
    case 'pos':
      return entry.senses.some((sense) => sense.pos === key) || (key === 'phrasal_verb' && entry.kind === 'phrasal_verb') || (key === 'expression' && entry.kind !== 'word' && entry.kind !== 'phrasal_verb')
    case 'synonyms':
      return entry.lemma.toLowerCase() === key || entry.synonyms.some((synonym) => synonym.toLowerCase() === key)
    default:
      return link.members.has(entry.id)
  }
}

/** Every rule of a good board, whatever the data it came from. */
function expectCleanBoard(board: ConnectionsBoard, label = '') {
  expect(board.groups, label).toHaveLength(GROUPS)
  const all = board.groups.flatMap((group) => group.entries)
  expect(all, label).toHaveLength(BOARD_WORDS)
  expect(new Set(all.map((entry) => entry.id)).size, label).toBe(BOARD_WORDS)
  expect(new Set(all.map((entry) => entry.lemma.toLowerCase())).size, label).toBe(BOARD_WORDS)
  expect(board.tiles.map((entry) => entry.id).sort(), label).toEqual(all.map((entry) => entry.id).sort())
  expect(new Set(board.groups.map((group) => group.link.id)).size, label).toBe(GROUPS)

  for (const group of board.groups) {
    expect(group.entries, label).toHaveLength(PER_GROUP)
    expect(group.link.label, label).not.toBe('')
    for (const entry of all) {
      // The link is true of the four words of its group and of none of the other twelve.
      expect(fits(group.link, entry), `${label} ${group.link.id} / ${entry.lemma}`).toBe(group.entries.includes(entry))
    }
  }
  for (const entry of all) expect(board.groups.filter((group) => fits(group.link, entry)), `${label} ${entry.lemma}`).toHaveLength(1)
}

describe('the links', () => {
  it('makes a link of a topic, a source, a type of word, a family, some synonyms and a verb pattern', () => {
    const topics = [topic('pub')]
    const sources = [source('peaky')]
    const withTopic = inTopic('pub', 4, { contexts: [context('peaky')] })
    const links = buildLinks(withTopic, topics, sources)
    const kinds = new Set(links.map((link) => link.kind))
    expect(kinds).toEqual(new Set(['topic', 'source', 'pos']))
    expect(links.find((link) => link.kind === 'topic')?.label).toBe('🍺 Tema pub')
    expect(links.find((link) => link.kind === 'source')?.label).toBe('Serie peaky')
  })

  it('needs four words for a link and ignores deleted topics', () => {
    expect(buildLinks(inTopic('pub', 3), [topic('pub')], []).filter((link) => link.kind === 'topic')).toHaveLength(0)
    expect(buildLinks(inTopic('pub', 4), [{ ...topic('pub'), deletedAt: 5 }], []).filter((link) => link.kind === 'topic')).toHaveLength(0)
  })

  it('a word with two kinds of sense fits both types, so it can never settle which group it is in', () => {
    const run = wordOf(entryOf('run', 'verb', { senses: [...verbOf('run', ['ran'], ['run']).senses, ...entryOf('run', 'noun').senses] }))
    const verbs = Array.from({ length: 4 }, (_, i) => wordOf(verbOf(`v${i}`, [`p${i}`], [`q${i}`])))
    const nouns = Array.from({ length: 4 }, (_, i) => wordOf(entryOf(`n${i}`, 'noun')))
    const links = buildLinks([run, ...verbs, ...nouns], [], [])
    expect(links.find((link) => link.id === 'pos:noun')?.members.has(run.entry.id)).toBe(true)
    expect(links.find((link) => link.id === 'pos:verb')?.members.has(run.entry.id)).toBe(true)
  })

  it('joins the words of a family, in either direction, and names the group after its shortest word', () => {
    const decide = wordOf(familyOf('decide', 'verb', [member('decision', 'noun'), member('decisive', 'adjective'), member('decisively', 'adverb'), member('indecisive', 'adjective')]))
    const decision = wordOf(entryOf('decision', 'noun'))
    const decisive = wordOf(entryOf('decisive', 'adjective'))
    const indecisive = wordOf(familyOf('indecisive', 'adjective', [member('decisive', 'adjective')]))
    const stranger = wordOf(entryOf('table', 'noun'))
    const family = buildLinks([decide, decision, decisive, indecisive, stranger], [], []).find((link) => link.kind === 'family')
    expect(family?.label).toBe('Familia de «decide»')
    expect([...(family?.members ?? [])].sort()).toEqual([decide, decision, decisive, indecisive].map((word) => word.entry.id).sort())
  })

  it('makes synonym links from the words that list a word, and the word itself when it is in the collection', () => {
    const huge = Array.from({ length: 3 }, (_, i) => wordOf(entryOf(`huge${i}`, 'adjective', { synonyms: ['big'] })))
    const big = wordOf(entryOf('big', 'adjective'))
    const link = buildLinks([...huge, big], [], []).find((candidate) => candidate.kind === 'synonyms')
    expect(link?.label).toBe('Sinónimos de «big»')
    expect(link?.members.size).toBe(4)
  })

  it('does not take four words with the same lemma for synonyms: nobody lists it', () => {
    const banks = Array.from({ length: 4 }, () => wordOf(entryOf('bank', 'noun')))
    expect(buildLinks(banks, [], []).filter((candidate) => candidate.kind === 'synonyms')).toHaveLength(0)
  })

  it('keeps one link where several have the same words (a clique of synonyms lists the same four words four times)', () => {
    const names = ['huge', 'enormous', 'giant', 'massive']
    const clique = names.map((name) => wordOf(entryOf(name, 'adjective', { synonyms: names.filter((other) => other !== name) })))
    expect(buildLinks(clique, [], []).filter((link) => link.kind === 'synonyms')).toHaveLength(1)
  })

  it('tells the patterns of verbs apart: regular, the three forms the same, past and participle the same, all different, -ought', () => {
    const verbs = [
      ...['walk', 'talk', 'work', 'play'].map((base) => verbOf(base, [`${base}ed`], [`${base}ed`])),
      ...['cut', 'put', 'hit', 'set'].map((base) => verbOf(base, [base], [base])),
      ...['sell', 'hold', 'keep', 'leave'].map((base, i) => verbOf(base, [['sold', 'held', 'kept', 'left'][i] as string], [['sold', 'held', 'kept', 'left'][i] as string])),
      verbOf('bring', ['brought'], ['brought']),
      verbOf('buy', ['bought'], ['bought']),
      verbOf('catch', ['caught'], ['caught']),
      verbOf('think', ['thought'], ['thought']),
    ].map((entry) => wordOf(entry))
    const byId = new Map(buildLinks(verbs, [], []).filter((link) => link.kind === 'verb_pattern').map((link) => [link.id.slice('verb_pattern:'.length), link]))
    expect([...(byId.get('regular')?.members ?? [])]).toHaveLength(4)
    expect([...(byId.get('aaa')?.members ?? [])]).toHaveLength(4)
    expect([...(byId.get('abb')?.members ?? [])]).toHaveLength(8)
    expect([...(byId.get('ought')?.members ?? [])]).toHaveLength(4)
    expect(byId.has('abc')).toBe(false) // none of those verbs has three different forms
  })
})

describe('findQuads', () => {
  it('only ever returns combinations in which every group keeps four words of its own', () => {
    const topics = ['a', 'b', 'c', 'd', 'e'].map(topic)
    // Words in two topics at once make a mess of the pools.
    const words = [...inTopic('a', 6), ...inTopic('b', 6), ...inTopic('c', 6), ...inTopic('d', 6), ...inTopic('e', 4)].map((word, index) => (index % 5 === 0 ? { ...word, entry: { ...word.entry, topicIds: [...word.entry.topicIds, 'e'] } } : word))
    const links = buildLinks(words, topics, [])
    for (let seed = 0; seed < 25; seed += 1) {
      for (const quad of findQuads(links, seededRng(seed), 5, 5_000)) {
        expect(quad.links).toHaveLength(GROUPS)
        quad.pools.forEach((pool, index) => {
          expect(pool.length).toBeGreaterThanOrEqual(PER_GROUP)
          for (const id of pool) {
            quad.links.forEach((link, other) => expect(link.members.has(id)).toBe(other === index))
          }
        })
      }
    }
  })

  it('finds nothing when no link has four words, and nothing at all when it has no steps left', () => {
    const topics = Array.from({ length: 30 }, (_, i) => topic(`t${i}`))
    const sparse = topics.flatMap((t) => inTopic(t.id, 3)) // no topic has four words: only "Sustantivos" is a link
    expect(findQuads(buildLinks(sparse, topics, []), seededRng(1), 1, 3_000)).toEqual([])

    const rich = topics.slice(0, 4).flatMap((t) => inTopic(t.id, 5))
    const links = buildLinks(rich, topics.slice(0, 4), [])
    expect(findQuads(links, seededRng(1), 1, 3_000)).toHaveLength(1)
    expect(findQuads(links, seededRng(1), 1, 0)).toEqual([])
  })
})

describe('planConnections: no word fits two of the groups of a board', () => {
  const topics = ['pub', 'office', 'kitchen', 'travel'].map(topic)

  it('makes a clean board of four topics', () => {
    const words = topics.flatMap((t) => inTopic(t.id, 6))
    for (let seed = 0; seed < 30; seed += 1) {
      const board = planConnections(words, topics, [], pickOptions({ rng: seededRng(seed) }))
      expect(board).not.toBeNull()
      if (board) {
        expectCleanBoard(board, `seed ${seed}`)
        expect(board.groups.every((group) => group.link.kind === 'topic')).toBe(true)
      }
    }
  })

  it('leaves out a word that fits two of the groups, however many times the board is drawn', () => {
    const shared = wordOf(entryOf('shared', 'noun', { topicIds: ['pub', 'office'] }))
    const words = [shared, ...topics.flatMap((t) => inTopic(t.id, 4))]
    for (let seed = 0; seed < 60; seed += 1) {
      const board = planConnections(words, topics, [], pickOptions({ rng: seededRng(seed) }))
      expect(board).not.toBeNull()
      if (board) {
        expectCleanBoard(board, `seed ${seed}`)
        expect(board.tiles.some((entry) => entry.id === shared.entry.id)).toBe(false)
      }
    }
  })

  it('does not make a board where the words cannot be told apart: every word in every topic, or thirty words and a single link', () => {
    const everywhere = Array.from({ length: 20 }, (_, i) => wordOf(entryOf(`any${i}`, 'noun', { topicIds: ['pub', 'office', 'kitchen', 'travel'] })))
    expect(planConnections(everywhere, topics, [], pickOptions())).toBeNull()
    const nouns = Array.from({ length: 30 }, (_, i) => wordOf(entryOf(`noun${i}`, 'noun')))
    expect(planConnections(nouns, [], [], pickOptions())).toBeNull()
    expect(hasConnectionsBoard(nouns, [], [])).toBe(false)
  })

  it('does not make a board with fifteen words, but does with sixteen', () => {
    const fifteen = [...inTopic('pub', 4), ...inTopic('office', 4), ...inTopic('kitchen', 4), ...inTopic('travel', 3)]
    expect(planConnections(fifteen, topics, [], pickOptions())).toBeNull()
    expect(planConnections([...fifteen, ...inTopic('travel', 1, {}, 'last')], topics, [], pickOptions())).not.toBeNull()
  })

  it('does not put two tiles that read the same in a board', () => {
    const twins = [...inTopic('pub', 5, {}, 'same'), ...inTopic('office', 4), ...inTopic('kitchen', 4), ...inTopic('travel', 4)]
    // "same0" appears twice among the pub words.
    const board = planConnections([...twins, wordOf(entryOf('same0', 'noun', { topicIds: ['pub'] }))], topics, [], pickOptions())
    expect(board).not.toBeNull()
    if (board) expectCleanBoard(board)
  })

  it('mixes kinds of link: a topic, a source, a type of word and a pattern of verbs', () => {
    const sources = [source('peaky')]
    const words = [
      ...inTopic('pub', 5),
      ...Array.from({ length: 5 }, (_, i) => wordOf(entryOf(`series${i}`, 'adjective', { contexts: [context('peaky')] }))),
      ...Array.from({ length: 5 }, (_, i) => wordOf(entryOf(`adv${i}`, 'adverb'))),
      ...['cut', 'put', 'hit', 'set', 'shut'].map((base) => wordOf(verbOf(base, [base], [base]))),
    ]
    const kinds = new Set<string>()
    for (let seed = 0; seed < 20; seed += 1) {
      const board = planConnections(words, [topic('pub')], sources, pickOptions({ rng: seededRng(seed) }))
      expect(board).not.toBeNull()
      if (board) {
        expectCleanBoard(board, `seed ${seed}`)
        board.groups.forEach((group) => kinds.add(group.link.kind))
      }
    }
    // Verbs, nouns, adjectives and adverbs also make a link each, but the pattern, topic and source ones are the ones that fit all of them.
    expect([...kinds]).toEqual(expect.arrayContaining(['topic', 'source']))
  })

  it('makes boards of synonyms, of families and of verb patterns', () => {
    const synonyms = [['huge', 'enormous', 'giant', 'massive'], ['tiny', 'minute', 'petite', 'wee'], ['quick', 'fast', 'rapid', 'swift'], ['happy', 'glad', 'cheerful', 'merry']]
    const synonymWords = synonyms.flatMap((group) => group.map((name) => wordOf(entryOf(name, 'adjective', { synonyms: [group[0] as string] }))))
    const board = planConnections(synonymWords, [], [], pickOptions())
    expect(board).not.toBeNull()
    if (board) {
      expectCleanBoard(board)
      expect(board.groups.every((group) => group.link.kind === 'synonyms')).toBe(true)
    }

    // Sixteen nouns: "Sustantivos" fits all of them, so only the families can make groups.
    const families = Array.from({ length: 4 }, (_, f) => Array.from({ length: 4 }, (_, i) => familyOf(`root${f}x${i}`, 'noun', [member(`root${f}x${(i + 1) % 4}`, 'noun'), member(`root${f}x${(i + 2) % 4}`, 'noun')])))
    const familyBoard = planConnections(families.flat().map((entry) => wordOf(entry)), [], [], pickOptions())
    expect(familyBoard).not.toBeNull()
    if (familyBoard) expect(familyBoard.groups.every((group) => group.link.kind === 'family')).toBe(true)

    const patterns = [
      ...['walk', 'talk', 'work', 'play'].map((base) => verbOf(base, [`${base}ed`], [`${base}ed`])),
      ...['cut', 'put', 'hit', 'set'].map((base) => verbOf(base, [base], [base])),
      ...[['sell', 'sold'], ['tell', 'told'], ['hold', 'held'], ['keep', 'kept']].map(([base, past]) => verbOf(base as string, [past as string], [past as string])),
      ...[['sing', 'sang', 'sung'], ['drink', 'drank', 'drunk'], ['swim', 'swam', 'swum'], ['begin', 'began', 'begun']].map(([base, past, part]) => verbOf(base as string, [past as string], [part as string])),
    ]
    const verbBoard = planConnections(patterns.map((entry) => wordOf(entry)), [], [], pickOptions())
    expect(verbBoard).not.toBeNull()
    if (verbBoard) {
      expectCleanBoard(verbBoard)
      expect(verbBoard.groups.every((group) => group.link.kind === 'verb_pattern')).toBe(true)
    }
  })

  it('is the same board for the same seed, and a different one for another', () => {
    const words = topics.flatMap((t) => inTopic(t.id, 8))
    const ids = (seed: number) => planConnections(words, topics, [], pickOptions({ rng: seededRng(seed) }))?.tiles.map((entry) => entry.id).join()
    expect(ids(3)).toBe(ids(3))
    expect(new Set(Array.from({ length: 10 }, (_, seed) => ids(seed))).size).toBeGreaterThan(5)
  })

  it('leans on the weakest words and the ones failed in a review', () => {
    const words = topics.flatMap((t) => inTopic(t.id, 10))
    const focus = new Set(topics.map((t) => words.find((word) => word.entry.topicIds.includes(t.id))?.entry.id ?? ''))
    let included = 0
    for (let seed = 0; seed < 60; seed += 1) {
      const board = planConnections(words, topics, [], pickOptions({ rng: seededRng(seed), focusIds: focus }))
      included += board?.tiles.filter((entry) => focus.has(entry.id)).length ?? 0
    }
    // Each of those words is one of ten in its group and four of the ten are drawn: with no lean it would be in 40 % of the boards.
    expect(included / (60 * focus.size)).toBeGreaterThan(0.55)
  })
})

describe('planConnections on random collections', () => {
  const kinds: PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb']

  function collection(seed: number, size: number): { words: GameWord[]; topics: ReturnType<typeof topic>[]; sources: ReturnType<typeof source>[] } {
    const rng = seededRng(seed * 7 + 1)
    const topics = Array.from({ length: 6 }, (_, i) => topic(`t${i}`))
    const sources = Array.from({ length: 3 }, (_, i) => source(`s${i}`))
    const words = Array.from({ length: size }, (_, i) => {
      const pos = kinds[Math.floor(rng() * kinds.length)] as PartOfSpeech
      const extra: Partial<Entry> = {
        topicIds: topics.filter(() => rng() < 0.2).slice(0, 2).map((t) => t.id),
        contexts: rng() < 0.3 ? [context(`s${Math.floor(rng() * 3)}`)] : [],
        synonyms: rng() < 0.3 ? [`syn${Math.floor(rng() * 4)}`] : [],
      }
      const lemma = `w${seed}x${i}`
      return wordOf(pos === 'verb' ? verbOf(lemma, rng() < 0.5 ? [`${lemma}ed`] : [`${lemma}t`], rng() < 0.5 ? [`${lemma}ed`] : [`${lemma}n`], extra) : entryOf(lemma, pos, extra))
    })
    return { words, topics, sources }
  }

  it('never has a word fit two groups, over 120 random collections', () => {
    let boards = 0
    for (let seed = 0; seed < 120; seed += 1) {
      const { words, topics, sources } = collection(seed, 40 + (seed % 5) * 10)
      const board = planConnections(words, topics, sources, pickOptions({ rng: seededRng(seed) }))
      // What the lock says is never wrong the other way round: if it opens the game, there is a board.
      if (hasConnectionsBoard(words, topics, sources)) expect(board, `seed ${seed}`).not.toBeNull()
      if (!board) continue
      boards += 1
      expectCleanBoard(board, `seed ${seed}`)
    }
    // Most of these collections do have a board; the test is not passing for lack of any.
    expect(boards).toBeGreaterThan(60)
  })

  it('is quick on a big collection', () => {
    const { words, topics, sources } = collection(999, 600)
    const board = planConnections(words, topics, sources, pickOptions())
    expect(board).not.toBeNull()
    if (board) expectCleanBoard(board)
  })

  it('counts the words that belong to some group for the lock, below sixteen when there is no board', () => {
    const lonely = Array.from({ length: 3 }, (_, i) => wordOf(entryOf(`lone${i}`, 'noun')))
    expect(wordsWithLinks(lonely, [], [])).toBe(0)
    const nouns = Array.from({ length: 30 }, (_, i) => wordOf(entryOf(`noun${i}`, 'noun')))
    expect(wordsWithLinks(nouns, [], [])).toBe(30)
  })
})

describe('judgeGuess', () => {
  const topics = ['pub', 'office', 'kitchen', 'travel'].map(topic)
  const words = topics.flatMap((t) => inTopic(t.id, 4))
  const board = planConnections(words, topics, [], pickOptions()) as ConnectionsBoard
  const ids = (group: number) => board.groups[group]?.entries.map((entry) => entry.id) ?? []

  it('knows a group, three of four ("one away") and a mistake', () => {
    expect(judgeGuess(board, ids(1), new Set())).toEqual({ kind: 'solved', group: 1 })
    expect(judgeGuess(board, [...ids(0).slice(0, 3), ...ids(2).slice(0, 1)], new Set())).toEqual({ kind: 'close' })
    expect(judgeGuess(board, [...ids(0).slice(0, 2), ...ids(2).slice(0, 2)], new Set())).toEqual({ kind: 'wrong' })
    expect(judgeGuess(board, [...ids(0).slice(0, 1), ...ids(1).slice(0, 1), ...ids(2).slice(0, 1), ...ids(3).slice(0, 1)], new Set())).toEqual({ kind: 'wrong' })
  })

  it('does not count a group that is already solved', () => {
    expect(judgeGuess(board, [...ids(0).slice(0, 3), ...ids(2).slice(0, 1)], new Set([0]))).toEqual({ kind: 'wrong' })
  })
})
