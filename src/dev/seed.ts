import { newFsrsCard } from '../srs/newCard.ts'
import type { Card, Entry, Source, Topic } from '../shared/index.ts'

/*
 * Test data for development only (it is never imported by the production app): up to 1,000
 * phrasal verbs (40 verbs x 25 particles) in every learning state, with topics, series and films.
 * Ids start with "seed-" so they can be removed again without touching the real words.
 */

export const SEED_PREFIX = 'seed-'

const VERBS: ReadonlyArray<readonly [string, string, string]> = [
  ['give', '/ɡɪv/', 'dar'], ['take', '/teɪk/', 'coger'], ['get', '/ɡet/', 'conseguir'], ['put', '/pʊt/', 'poner'],
  ['set', '/set/', 'fijar'], ['turn', '/tɜːn/', 'girar'], ['look', '/lʊk/', 'mirar'], ['come', '/kʌm/', 'venir'],
  ['go', '/ɡəʊ/', 'ir'], ['run', '/rʌn/', 'correr'], ['bring', '/brɪŋ/', 'traer'], ['break', '/breɪk/', 'romper'],
  ['call', '/kɔːl/', 'llamar'], ['carry', '/ˈkæri/', 'llevar'], ['check', '/tʃek/', 'comprobar'], ['cut', '/kʌt/', 'cortar'],
  ['drop', '/drɒp/', 'soltar'], ['fall', '/fɔːl/', 'caer'], ['fill', '/fɪl/', 'llenar'], ['find', '/faɪnd/', 'encontrar'],
  ['hold', '/həʊld/', 'sostener'], ['keep', '/kiːp/', 'mantener'], ['knock', '/nɒk/', 'golpear'], ['let', '/let/', 'dejar'],
  ['make', '/meɪk/', 'hacer'], ['move', '/muːv/', 'mover'], ['pick', '/pɪk/', 'recoger'], ['pull', '/pʊl/', 'tirar'],
  ['push', '/pʊʃ/', 'empujar'], ['show', '/ʃəʊ/', 'mostrar'], ['sit', '/sɪt/', 'sentarse'], ['stand', '/stænd/', 'estar de pie'],
  ['switch', '/swɪtʃ/', 'cambiar'], ['throw', '/θrəʊ/', 'lanzar'], ['try', '/traɪ/', 'probar'], ['wake', '/weɪk/', 'despertar'],
  ['walk', '/wɔːk/', 'caminar'], ['work', '/wɜːk/', 'trabajar'], ['write', '/raɪt/', 'escribir'], ['hang', '/hæŋ/', 'colgar'],
]

const PARTICLES: ReadonlyArray<readonly [string, string, string]> = [
  ['up', '/ʌp/', 'arriba'], ['down', '/daʊn/', 'abajo'], ['in', '/ɪn/', 'dentro'], ['out', '/aʊt/', 'fuera'],
  ['on', '/ɒn/', 'encima'], ['off', '/ɒf/', 'apagado'], ['over', '/ˈəʊvə/', 'sobre'], ['away', '/əˈweɪ/', 'lejos'],
  ['back', '/bæk/', 'de vuelta'], ['through', '/θruː/', 'a través'], ['around', '/əˈraʊnd/', 'alrededor'], ['along', '/əˈlɒŋ/', 'a lo largo'],
  ['by', '/baɪ/', 'junto a'], ['for', '/fɔː/', 'para'], ['into', '/ˈɪntuː/', 'hacia dentro'], ['apart', '/əˈpɑːt/', 'separado'],
  ['ahead', '/əˈhed/', 'adelante'], ['aside', '/əˈsaɪd/', 'a un lado'], ['forward', '/ˈfɔːwəd/', 'hacia delante'], ['behind', '/bɪˈhaɪnd/', 'detrás'],
  ['together', '/təˈɡeðə/', 'juntos'], ['across', '/əˈkrɒs/', 'al otro lado'], ['after', '/ˈɑːftə/', 'después'], ['against', '/əˈɡenst/', 'contra'],
  ['at', '/æt/', 'en'],
]

const TOPICS: ReadonlyArray<readonly [string, string]> = [
  ['En el pub', '🍺'], ['En la oficina', '💼'], ['Viajes', '✈️'], ['Discusiones y enfados', '😡'],
  ['En casa', '🏠'], ['Compras', '🛒'], ['Salud', '🏥'], ['Deporte', '⚽'],
]
const COLORS = ['#f3d58a', '#9fdcbf', '#a9c8f2', '#cdb4f0', '#f5c29e', '#9edfd6', '#f2b5d4', '#f2a7a7']

const SOURCES = [
  'Peaky Blinders', 'Derry Girls', 'The Crown', 'Sherlock', 'Fleabag', 'Ted Lasso', 'Harry Potter', 'The Office UK', 'Bake Off', 'Luther',
]

/** Small deterministic random generator, so the same seed always gives the same collection. */
function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface SeedData {
  entries: Entry[]
  cards: Card[]
  topics: Topic[]
  sources: Source[]
}

/** A card in the given FSRS state, with plausible numbers. */
function cardAt(entryId: string, type: Card['type'], kind: 'new' | 'learning' | 'review' | 'consolidated' | 'mastered', now: number, random: () => number): Card {
  const base = newFsrsCard(now)
  if (kind === 'new') {
    return { id: `${SEED_PREFIX}c-${type}-${entryId}`, entryId, type, fsrs: base, due: now, unlocked: type === 'recognition', suspended: false, stats: { seen: 0, correct: 0, wrong: 0, streak: 0 }, updatedAt: now }
  }
  const day = 86_400_000
  const stability = { learning: 1, review: 8, consolidated: 35, mastered: 120 }[kind]
  const state = kind === 'learning' ? 1 : 2
  const seen = 2 + Math.floor(random() * 14)
  const wrong = Math.floor(random() * Math.min(seen, 4))
  const due = now + (kind === 'learning' ? Math.floor(random() * 3 - 1) * 600_000 : Math.floor(random() * stability * 1.4 - stability * 0.2) * day)
  return {
    id: `${SEED_PREFIX}c-${type}-${entryId}`,
    entryId,
    type,
    fsrs: { ...base, state, stability, difficulty: 3 + random() * 5, scheduled_days: stability, reps: seen, lapses: wrong, due, last_review: now - day },
    due,
    unlocked: true,
    suspended: false,
    stats: { seen, correct: seen - wrong, wrong, streak: kind === 'mastered' ? 6 + Math.floor(random() * 6) : Math.floor(random() * 4), lastSeenAt: now - day },
    updatedAt: now,
  }
}

/** Builds `count` (at most 1,000) entries with their cards, topics and sources. */
export function generateSeedData(count = 1000, now = Date.now()): SeedData {
  const random = mulberry32(2026)
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T

  const topics: Topic[] = TOPICS.map(([nameEs, emoji], index) => ({
    id: `${SEED_PREFIX}topic-${index}`, nameEs, emoji, color: COLORS[index] ?? '#b8b8c2', updatedAt: now,
  }))
  const sources: Source[] = SOURCES.map((title, index) => ({
    id: `${SEED_PREFIX}source-${index}`, title, type: 'series', lastUsedAt: now - index * 3_600_000, updatedAt: now,
  }))

  const entries: Entry[] = []
  const cards: Card[] = []
  const limit = Math.min(count, VERBS.length * PARTICLES.length)

  for (let i = 0; i < limit; i += 1) {
    const [verb, verbIpa, verbEs] = VERBS[Math.floor(i / PARTICLES.length)] as (typeof VERBS)[number]
    const [particle, particleIpa, particleEs] = PARTICLES[i % PARTICLES.length] as (typeof PARTICLES)[number]
    const lemma = `${verb} ${particle}`
    const id = `${SEED_PREFIX}${String(i).padStart(4, '0')}`
    const roll = random()
    const status: Entry['status'] = roll < 0.03 ? 'pending_ai' : roll < 0.08 ? 'archived' : 'active'
    const sourceId = random() < 0.7 ? (pick(sources).id) : undefined
    const meaningEs = `${verbEs} (${particleEs})`

    entries.push({
      id,
      lemma,
      lemmaKey: lemma,
      kind: 'phrasal_verb',
      ipa: status === 'pending_ai' ? '' : `${verbIpa.slice(0, -1)} ${particleIpa.slice(1)}`,
      audioCheckedAt: now,
      senses:
        status === 'pending_ai'
          ? []
          : [
              {
                id: `${id}-s1`,
                pos: 'phrasal_verb',
                meaningEs,
                definitionEn: `to ${verb} something ${particle}`,
                register: 'neutral',
                examples: [{ en: `She decided to ${lemma} yesterday.`, es: `Decidió ${verbEs} ayer.`, target: lemma }],
                matchesContext: true,
              },
            ],
      family: [],
      synonyms: [],
      antonyms: [],
      collocations: [],
      topicIds: random() < 0.75 ? [...new Set([pick(topics).id, ...(random() < 0.3 ? [pick(topics).id] : [])])] : [],
      contexts: sourceId
        ? [{ id: `${id}-c1`, sentence: `They had to ${lemma} before dinner.`, sourceId, addedAt: now - i * 60_000 }]
        : [],
      status,
      isLeech: status === 'active' && random() < 0.04,
      createdAt: now - i * 3_600_000,
      updatedAt: now,
    })

    if (status === 'pending_ai') continue
    const kind = (['new', 'new', 'learning', 'review', 'review', 'consolidated', 'mastered'] as const)[Math.floor(random() * 7)] ?? 'new'
    cards.push(cardAt(id, 'recognition', kind, now, random))
    cards.push(cardAt(id, 'production', kind === 'new' || kind === 'learning' ? 'new' : kind, now, random))
  }
  return { entries, cards, topics, sources }
}
