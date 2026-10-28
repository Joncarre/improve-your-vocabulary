import type { GameId } from '../shared/index.ts'
import { studyDayKey } from '../srs/studyDay.ts'
import { ALL_WORDS } from './scope.ts'
import { availability, GAMES, resolveVariant, type GameContext } from './registry.ts'
import { wordsInScope, type GameWord } from './words.ts'

export interface GameSuggestion {
  game: GameId
  name: string
  blurb: string
  /** Words that can be played in it. */
  words: number
}

/** A number that changes from one study day to the next but not within a day. */
function daySeed(key: string): number {
  return [...key].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7) >>> 0
}

/**
 * The game Hoy suggests (spec §9): one of those that can be played with the words already seen, a
 * different one each study day. The game itself leans towards the weakest words. Historia is never
 * suggested: it spends AI credit and needs a connection, so it is the player's own choice.
 */
export function suggestGame(words: readonly GameWord[], now: number, dayStartHour: number, context: GameContext = { topics: [], sources: [] }): GameSuggestion | null {
  const seen = wordsInScope(words, ALL_WORDS)
  const open = GAMES.flatMap((info) => {
    const found = availability(info, seen, resolveVariant(info, undefined), context)
    return found.open && !info.needsConnection ? [{ info, playable: found.playable }] : []
  })
  const chosen = open[daySeed(studyDayKey(now, dayStartHour)) % Math.max(1, open.length)]
  return chosen ? { game: chosen.info.id, name: chosen.info.name, blurb: chosen.info.blurb, words: chosen.playable } : null
}
