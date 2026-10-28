import type { Source, Topic } from '../shared/index.ts'

/** Which words a game draws from (spec §8): everything, a topic, a series, the "rebeldes" or the latest added. */
export type GameScope =
  | { kind: 'all' }
  | { kind: 'topic'; topicId: string }
  | { kind: 'source'; sourceId: string }
  | { kind: 'leeches' }
  | { kind: 'recent' }
  /** The words failed in a review: they come first, and other words you have seen fill the rest. */
  | { kind: 'focus'; entryIds: string[] }

export const ALL_WORDS: GameScope = { kind: 'all' }

/** "Últimas añadidas" are the newest of the words that can be played. */
export const RECENT_WORDS = 20
/** A review summary offers at most this many failed words. */
export const MAX_FOCUS_WORDS = 20

/** The scope as search parameters, so a link or a reload keeps it. */
export function scopeToParams(scope: GameScope): URLSearchParams {
  const params = new URLSearchParams()
  if (scope.kind === 'all') return params
  params.set('scope', scope.kind)
  if (scope.kind === 'topic') params.set('id', scope.topicId)
  if (scope.kind === 'source') params.set('id', scope.sourceId)
  if (scope.kind === 'focus') params.set('ids', scope.entryIds.join(','))
  return params
}

export function scopeFromParams(params: URLSearchParams): GameScope {
  const id = params.get('id') ?? ''
  switch (params.get('scope')) {
    case 'topic':
      return id ? { kind: 'topic', topicId: id } : ALL_WORDS
    case 'source':
      return id ? { kind: 'source', sourceId: id } : ALL_WORDS
    case 'leeches':
      return { kind: 'leeches' }
    case 'recent':
      return { kind: 'recent' }
    case 'focus': {
      const entryIds = (params.get('ids') ?? '').split(',').filter(Boolean).slice(0, MAX_FOCUS_WORDS)
      return entryIds.length > 0 ? { kind: 'focus', entryIds } : ALL_WORDS
    }
    default:
      return ALL_WORDS
  }
}

/** Search parameters of a game link: the scope and whether words not yet reviewed are included. */
export function gameSearch(scope: GameScope, includeNew = false): string {
  const params = scopeToParams(scope)
  if (includeNew) params.set('new', '1')
  const text = params.toString()
  return text ? `?${text}` : ''
}

export function includeNewFromParams(params: URLSearchParams): boolean {
  return params.get('new') === '1'
}

/** "Todas tus palabras", "Tema: En el pub"... for the line that says what is being played. */
export function describeScope(scope: GameScope, topics: readonly Topic[], sources: readonly Source[]): string {
  switch (scope.kind) {
    case 'all':
      return 'Todas tus palabras'
    case 'topic':
      return `Tema: ${topics.find((topic) => topic.id === scope.topicId)?.nameEs ?? 'borrado'}`
    case 'source':
      return `Fuente: ${sources.find((source) => source.id === scope.sourceId)?.title ?? 'borrada'}`
    case 'leeches':
      return 'Rebeldes'
    case 'recent':
      return 'Últimas añadidas'
    case 'focus':
      return scope.entryIds.length === 1 ? 'La palabra que has fallado' : 'Las palabras que has fallado'
  }
}
