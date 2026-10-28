import { formCandidates } from '../lib/highlight.ts'
import type { Entry, PartOfSpeech, Source, Topic } from '../shared/index.ts'
import { normalizeAnswer } from '../srs/checker.ts'
import { seededRng, shuffle, weightedSample, type Rng } from './rng.ts'
import { wordWeight, type GameWord, type PickOptions } from './words.ts'

/** The six kinds of hidden link (spec §8). */
export type LinkKind = 'topic' | 'source' | 'pos' | 'family' | 'synonyms' | 'verb_pattern'

export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  topic: 'Tema',
  source: 'Fuente',
  pos: 'Tipo de palabra',
  family: 'Misma familia',
  synonyms: 'Sinónimos',
  verb_pattern: 'Patrón verbal',
}

/** 4 groups of 4 words: the 4 × 4 grid. */
export const GROUPS = 4
export const PER_GROUP = 4
export const BOARD_WORDS = GROUPS * PER_GROUP

/** A hidden link and every word (of those the board is drawn from) that fits it. */
export interface Link {
  id: string
  kind: LinkKind
  /** What is shown when the group is solved. */
  label: string
  /** Ids of the entries that fit the link. */
  members: ReadonlySet<string>
}

const idsOf = (words: readonly GameWord[], fits: (entry: Entry) => boolean) =>
  new Set(words.filter((word) => fits(word.entry)).map((word) => word.entry.id))

/* ---------- Where the links come from ---------- */

function topicLinks(words: readonly GameWord[], topics: readonly Topic[]): Link[] {
  return topics
    .filter((topic) => topic.deletedAt === undefined)
    .map((topic) => ({
      id: `topic:${topic.id}`,
      kind: 'topic',
      label: `${topic.emoji} ${topic.nameEs}`.trim(),
      members: idsOf(words, (entry) => entry.topicIds.includes(topic.id)),
    }))
}

function sourceLinks(words: readonly GameWord[], sources: readonly Source[]): Link[] {
  return sources
    .filter((source) => source.deletedAt === undefined)
    .map((source) => ({
      id: `source:${source.id}`,
      kind: 'source',
      label: source.title,
      members: idsOf(words, (entry) => entry.contexts.some((context) => context.sourceId === source.id)),
    }))
}

const hasPos = (entry: Entry, ...kinds: PartOfSpeech[]) => entry.senses.some((sense) => kinds.includes(sense.pos))

/** A word fits a type when any of its senses is of that type: "run" is a verb and a noun, so it never settles which of the two groups it is in. */
const POS_GROUPS: ReadonlyArray<{ id: string; label: string; fits: (entry: Entry) => boolean }> = [
  { id: 'noun', label: 'Sustantivos', fits: (entry) => hasPos(entry, 'noun') },
  { id: 'verb', label: 'Verbos', fits: (entry) => hasPos(entry, 'verb') },
  { id: 'adjective', label: 'Adjetivos', fits: (entry) => hasPos(entry, 'adjective') },
  { id: 'adverb', label: 'Adverbios', fits: (entry) => hasPos(entry, 'adverb') },
  { id: 'phrasal_verb', label: 'Phrasal verbs', fits: (entry) => entry.kind === 'phrasal_verb' || hasPos(entry, 'phrasal_verb') },
  { id: 'expression', label: 'Expresiones y modismos', fits: (entry) => entry.kind === 'idiom' || entry.kind === 'expression' || hasPos(entry, 'idiom', 'expression') },
]

function posLinks(words: readonly GameWord[]): Link[] {
  return POS_GROUPS.map((group) => ({ id: `pos:${group.id}`, kind: 'pos', label: group.label, members: idsOf(words, group.fits) }))
}

/** Words of one family: entries are joined when one lists the other (or both list the same word) in its family. */
function familyLinks(words: readonly GameWord[]): Link[] {
  const parent = new Map(words.map((word) => [word.entry.id, word.entry.id]))
  const find = (id: string): string => {
    let root = id
    while (parent.get(root) !== root) root = parent.get(root) ?? root
    return root
  }
  const union = (a: string, b: string) => parent.set(find(a), find(b))

  const names = new Map<string, string[]>()
  const families = new Map<string, string[]>()
  const push = (index: Map<string, string[]>, key: string, id: string) => index.set(key, [...(index.get(key) ?? []), id])
  for (const { entry } of words) {
    for (const form of formCandidates(entry)) push(names, normalizeAnswer(form), entry.id)
    for (const member of entry.family) if (member.word.trim()) push(families, normalizeAnswer(member.word), entry.id)
  }
  for (const [key, listing] of families) {
    const [first, ...rest] = [...listing, ...(names.get(key) ?? [])]
    for (const id of rest) if (first !== undefined) union(first, id)
  }

  const groups = new Map<string, GameWord[]>()
  for (const word of words) groups.set(find(word.entry.id), [...(groups.get(find(word.entry.id)) ?? []), word])
  return [...groups.entries()].map(([root, members]) => {
    const base = [...members].sort((a, b) => a.entry.lemma.length - b.entry.lemma.length || a.entry.lemma.localeCompare(b.entry.lemma))[0]
    return { id: `family:${root}`, kind: 'family', label: `Familia de «${base?.entry.lemma ?? ''}»`, members: new Set(members.map((word) => word.entry.id)) }
  })
}

/** Words that mean the same: those that list a word as a synonym, and that word itself when it is in the collection. */
function synonymLinks(words: readonly GameWord[]): Link[] {
  const byKey = new Map<string, { shown: string; ids: Set<string> }>()
  const add = (text: string, id: string) => {
    const key = normalizeAnswer(text)
    if (!key) return
    const found = byKey.get(key) ?? { shown: text.trim(), ids: new Set<string>() }
    found.ids.add(id)
    byKey.set(key, found)
  }
  for (const { entry } of words) add(entry.lemma, entry.id)
  // A word that no entry lists as a synonym is only a lemma, not a link.
  const listed = new Set<string>()
  for (const { entry } of words) {
    for (const synonym of entry.synonyms) {
      add(synonym, entry.id)
      listed.add(normalizeAnswer(synonym))
    }
  }
  return [...byKey.entries()]
    .filter(([key]) => listed.has(key))
    .map(([key, { shown, ids }]) => ({ id: `synonyms:${key}`, kind: 'synonyms' as const, label: `Sinónimos de «${shown}»`, members: ids }))
}

type VerbForms = NonNullable<NonNullable<Entry['forms']>['verb']>

const VERB_SHAPES: Record<string, string> = {
  regular: 'Verbos regulares (-ed)',
  aaa: 'Las tres formas son iguales (cut – cut – cut)',
  aab: 'Base y pasado iguales (beat – beat – beaten)',
  aba: 'Base y participio iguales (come – came – come)',
  abb: 'Pasado y participio iguales (buy – bought – bought)',
  abc: 'Las tres formas son distintas (sing – sang – sung)',
  ought: 'Pasado en -ought / -aught (bought, caught)',
}

/** The patterns a verb follows: regular, or how its three forms repeat, and the -ought endings. */
function verbPatterns(verb: VerbForms): string[] {
  const base = normalizeAnswer(verb.base)
  const past = normalizeAnswer(verb.pastSimple[0] ?? '')
  const participle = normalizeAnswer(verb.pastParticiple[0] ?? '')
  if (!base || !past || !participle) return []
  if (!verb.irregular) return ['regular']
  const shape = base === past && past === participle ? 'aaa' : past === participle ? 'abb' : base === participle ? 'aba' : base === past ? 'aab' : 'abc'
  return /(ought|aught)$/.test(past) ? [shape, 'ought'] : [shape]
}

function verbPatternLinks(words: readonly GameWord[]): Link[] {
  return Object.entries(VERB_SHAPES).map(([pattern, label]) => ({
    id: `verb_pattern:${pattern}`,
    kind: 'verb_pattern',
    label,
    members: idsOf(words, (entry) => (entry.forms?.verb ? verbPatterns(entry.forms.verb).includes(pattern) : false)),
  }))
}

/** Two links with the same kind and the same words are one link (a clique of synonyms lists its words in each of them). */
function withoutRepeats(links: readonly Link[]): Link[] {
  const seen = new Set<string>()
  return links.filter((link) => {
    const key = `${link.kind}:${[...link.members].sort().join(',')}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Every link that has at least four words to make a group of (the words are those of the scope). */
export function buildLinks(words: readonly GameWord[], topics: readonly Topic[], sources: readonly Source[]): Link[] {
  const all = [...topicLinks(words, topics), ...sourceLinks(words, sources), ...posLinks(words), ...familyLinks(words), ...synonymLinks(words), ...verbPatternLinks(words)]
  return withoutRepeats(all.filter((link) => link.members.size >= PER_GROUP))
}

/* ---------- Four links without ambiguity ---------- */

/** Four links and, for each, the words that fit it and none of the other three. */
export interface Quad {
  links: Link[]
  pools: string[][]
}

/** Steps the search may take before it gives up (it is a search among the combinations of links). */
export const CHECK_BUDGET = 3_000
export const PLAY_BUDGET = 20_000

/**
 * Looks for up to `limit` combinations of four links in which every group still has four words of its own: words
 * that fit its link and none of the other three. That is the whole guarantee that no word fits two of the chosen
 * groups: a board only ever takes its words from those pools. The pools can only shrink as links are added, so a
 * combination whose pool is already too small is dropped at once.
 */
export function findQuads(links: readonly Link[], rng: Rng, limit: number, budget: number): Quad[] {
  const order = shuffle(links, rng)
  const found: Quad[] = []
  let steps = 0

  const walk = (from: number, chosen: Link[], pools: string[][]) => {
    if (chosen.length === GROUPS) {
      found.push({ links: chosen, pools })
      return
    }
    for (let at = from; at < order.length && found.length < limit && steps < budget; at += 1) {
      steps += 1
      const next = order[at] as Link
      const narrowed = pools.map((pool) => pool.filter((id) => !next.members.has(id)))
      const own = [...next.members].filter((id) => !chosen.some((link) => link.members.has(id)))
      if (own.length < PER_GROUP || narrowed.some((pool) => pool.length < PER_GROUP)) continue
      walk(at + 1, [...chosen, next], [...narrowed, own])
    }
  }
  walk(0, [], [])
  return found
}

/** The combination the lock is decided with: always the same for the same words, so the hub does not change its mind. */
const CHECK_SEED = 11

/** Whether the words can make a board at all (spec §8: "mínimo 16 palabras que formen 4 grupos válidos"). */
export function hasConnectionsBoard(words: readonly GameWord[], topics: readonly Topic[], sources: readonly Source[]): boolean {
  return findQuads(buildLinks(words, topics, sources), seededRng(CHECK_SEED), 1, CHECK_BUDGET).length > 0
}

/** How many words belong to at least one link with four words or more: what the "N words" of the lock is made from. */
export function wordsWithLinks(words: readonly GameWord[], topics: readonly Topic[], sources: readonly Source[]): number {
  const linked = new Set<string>()
  for (const link of buildLinks(words, topics, sources)) for (const id of link.members) linked.add(id)
  return linked.size
}

/* ---------- The board ---------- */

export interface ConnectionsGroup {
  link: Link
  entries: Entry[]
}

export interface ConnectionsBoard {
  groups: ConnectionsGroup[]
  /** The 16 words in the order they are laid out. */
  tiles: Entry[]
}

interface Candidate {
  board: ConnectionsBoard
  score: number
}

/** Four words from each pool, drawn by weight, with no two tiles that read the same. */
function fillBoard(quad: Quad, byId: ReadonlyMap<string, GameWord>, pick: PickOptions): Candidate | null {
  const used = new Set<string>()
  let score = 0
  const groups: ConnectionsGroup[] = []
  for (const [index, link] of quad.links.entries()) {
    const weight = (word: GameWord) => wordWeight(word, pick) * (pick.focusIds?.has(word.entry.id) ? 3 : 1)
    const candidates = (quad.pools[index] ?? []).flatMap((id) => {
      const word = byId.get(id)
      return word && !used.has(normalizeAnswer(word.entry.lemma)) ? [word] : []
    })
    const chosen: GameWord[] = []
    for (const word of weightedSample(candidates, weight, candidates.length, pick.rng)) {
      const key = normalizeAnswer(word.entry.lemma)
      if (chosen.length < PER_GROUP && !chosen.some((other) => normalizeAnswer(other.entry.lemma) === key)) chosen.push(word)
    }
    if (chosen.length < PER_GROUP) return null
    for (const word of chosen) {
      used.add(normalizeAnswer(word.entry.lemma))
      score += weight(word)
    }
    groups.push({ link, entries: chosen.map((word) => word.entry) })
  }
  return { board: { groups, tiles: shuffle(groups.flatMap((group) => group.entries), pick.rng) }, score }
}

const CANDIDATE_BOARDS = 10

/**
 * A board of four groups of four words: the link of each group is true of its four words and of none of the
 * other twelve. Among several possible boards the one with the weakest words is more likely. Null when the words
 * cannot make one.
 */
export function planConnections(words: readonly GameWord[], topics: readonly Topic[], sources: readonly Source[], pick: PickOptions): ConnectionsBoard | null {
  const links = buildLinks(words, topics, sources)
  const byId = new Map(words.map((word) => [word.entry.id, word]))
  let quads = findQuads(links, pick.rng, CANDIDATE_BOARDS, PLAY_BUDGET)
  // The random search may run out of steps where the fixed one of the lock did not: then it falls back on that one.
  if (quads.length === 0) quads = findQuads(links, seededRng(CHECK_SEED), CANDIDATE_BOARDS, CHECK_BUDGET)
  const boards = quads.flatMap((quad) => {
    const candidate = fillBoard(quad, byId, pick)
    return candidate ? [candidate] : []
  })
  return weightedSample(boards, (candidate) => candidate.score, 1, pick.rng)[0]?.board ?? null
}

/* ---------- Playing ---------- */

export type Guess = { kind: 'solved'; group: number } | { kind: 'close' } | { kind: 'wrong' }

/** What four chosen words are: a group (not yet solved), three out of four of one ("one away", as in the original), or a mistake. */
export function judgeGuess(board: ConnectionsBoard, selected: readonly string[], solved: ReadonlySet<number>): Guess {
  let best = 0
  for (const [index, group] of board.groups.entries()) {
    if (solved.has(index)) continue
    const inside = group.entries.filter((entry) => selected.includes(entry.id)).length
    if (inside === PER_GROUP && selected.length === PER_GROUP) return { kind: 'solved', group: index }
    best = Math.max(best, inside)
  }
  return best === PER_GROUP - 1 ? { kind: 'close' } : { kind: 'wrong' }
}
