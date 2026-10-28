import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { GameId } from '../../shared/index.ts'
import type { GamePlayProps } from './types.ts'

/** One chunk per game: a game's code is downloaded only when it is played (spec §8). */
export const GAME_COMPONENTS: Partial<Record<GameId, LazyExoticComponent<ComponentType<GamePlayProps>>>> = {
  match: lazy(() => import('./match/MatchGame.tsx')),
  cloze: lazy(() => import('./cloze/ClozeGame.tsx')),
  verb_forms: lazy(() => import('./verbForms/VerbFormsGame.tsx')),
  family: lazy(() => import('./family/FamilyGame.tsx')),
}
