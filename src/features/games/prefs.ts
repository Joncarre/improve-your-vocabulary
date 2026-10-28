import type { GameId } from '../../shared/index.ts'

const STORAGE_KEY = 'vocab.games.v1'

function readAll(): Record<string, unknown> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    return typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** The version of a game played last time (a convenience on this device: the game works without it). */
export function loadVariant(game: GameId): string | undefined {
  const value = readAll()[game]
  return typeof value === 'string' ? value : undefined
}

export function saveVariant(game: GameId, variant: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), [game]: variant }))
  } catch {
    // Private mode or blocked storage: the choice just is not remembered.
  }
}
