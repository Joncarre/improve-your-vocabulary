import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, Gamepad2, Grid3x3, Headphones, Lock, Network, PenLine, Repeat, Waypoints, type LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { loadGameData } from '../../games/data.ts'
import { availability, GAMES, resolveVariant, type GameInfo } from '../../games/registry.ts'
import { wordsInScope } from '../../games/words.ts'
import type { GameId } from '../../shared/index.ts'
import { Chip } from '../../ui/Chip.tsx'
import { PageHeader } from '../../ui/PageHeader.tsx'
import { Skeleton } from '../../ui/Skeleton.tsx'
import { loadVariant } from './prefs.ts'
import { ScopePicker } from './ScopePicker.tsx'
import { useGameScope } from './useGameScope.ts'

const ICONS: Record<GameId, LucideIcon> = {
  match: Grid3x3,
  cloze: PenLine,
  verb_forms: Repeat,
  family: Network,
  dictation: Headphones,
  connections: Waypoints,
  story: BookOpen,
}

interface GameCardProps {
  info: GameInfo
  playable: number
  open: boolean
  search: string
}

function GameCard({ info, playable, open, search }: GameCardProps) {
  const Icon = ICONS[info.id]
  const body = (
    <>
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 ${open ? 'text-accent' : 'text-text-3'}`}>
        {info.ready && !open ? <Lock size={18} strokeWidth={1.75} aria-hidden="true" /> : <Icon size={20} strokeWidth={1.75} aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-section font-semibold">{info.name}</span>
          {info.ready ? null : <Chip tone="other">Próximamente</Chip>}
          {info.needsConnection ? <Chip tone="other">Con conexión</Chip> : null}
        </span>
        <span className="block text-secondary text-text-2">{info.blurb}</span>
        {info.ready && !open ? (
          <span className="mt-1 block text-secondary text-hard">
            Necesitas {info.min} palabras para jugar
            <span className="block text-caption text-text-3">{playable === 1 ? 'Con este alcance hay 1 que sirva.' : `Con este alcance hay ${playable} que sirvan.`}</span>
          </span>
        ) : null}
      </span>
    </>
  )

  const base = 'flex min-h-20 items-center gap-3 rounded-card border border-border bg-surface p-3'
  return open ? (
    <Link to={`/games/${info.id}${search}`} className={`${base} active:bg-surface-2`}>
      {body}
    </Link>
  ) : (
    <div aria-disabled="true" className={`${base} opacity-70`}>
      {body}
    </div>
  )
}

/** Juegos (spec §8): the seven games, with the scope to play with and the lock when there are too few words. */
export default function GamesPage() {
  const data = useLiveQuery(() => loadGameData(), [])
  const { scope, includeNew, search, setScope, setIncludeNew } = useGameScope()

  const inScope = useMemo(() => (data ? wordsInScope(data.words, scope, includeNew) : []), [data, scope, includeNew])

  return (
    <>
      <PageHeader title="Juegos" />
      {data === undefined ? (
        <div role="status" aria-label="Cargando" className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="space-y-5">
          <ScopePicker
            scope={scope}
            includeNew={includeNew}
            words={data.words}
            topics={data.topics}
            sources={data.sources}
            count={inScope.length}
            onScope={setScope}
            onIncludeNew={setIncludeNew}
          />
          {data.words.length === 0 ? (
            <p className="flex items-start gap-2 rounded-card border border-border bg-surface p-3 text-secondary text-text-2">
              <Gamepad2 size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              Los juegos se desbloquean cuando tengas suficientes palabras ya vistas en el repaso.
            </p>
          ) : null}
          <ul className="grid gap-3 md:grid-cols-2">
            {GAMES.map((info) => {
              const found = availability(info, inScope, resolveVariant(info, loadVariant(info.id)), data)
              return (
                <li key={info.id}>
                  <GameCard info={info} playable={found.playable} open={found.open} search={search} />
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </>
  )
}
