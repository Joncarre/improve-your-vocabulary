import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { gameSearch, includeNewFromParams, scopeFromParams, type GameScope } from '../../games/scope.ts'

/** The scope of the games lives in the address, so links from other screens can open a game already narrowed and a reload keeps it. */
export function useGameScope() {
  const [params, setParams] = useSearchParams()
  const key = params.toString()
  const scope = useMemo(() => scopeFromParams(new URLSearchParams(key)), [key])
  const includeNew = includeNewFromParams(params)

  const update = (nextScope: GameScope, nextIncludeNew: boolean) => setParams(new URLSearchParams(gameSearch(nextScope, nextIncludeNew)), { replace: true })

  return {
    scope,
    includeNew,
    /** "?scope=…" to append to a link, or an empty string. */
    search: gameSearch(scope, includeNew),
    setScope: (next: GameScope) => update(next, includeNew),
    setIncludeNew: (next: boolean) => update(scope, next),
  }
}
