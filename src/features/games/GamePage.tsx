import { SearchX, Trophy } from 'lucide-react'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { primeSpeech } from '../../audio/speech.ts'
import { useDeviceSettings } from '../../db/settings.ts'
import { loadGameData, type GameData } from '../../games/data.ts'
import { isBetterResult, loadBestResult, loadGameTurns, recordGameAnswer, saveGameResult, type GameAnswer } from '../../games/record.ts'
import { availability, gameInfo, resolveVariant } from '../../games/registry.ts'
import { describeScope } from '../../games/scope.ts'
import { wordsInScope, type PickOptions } from '../../games/words.ts'
import type { GameResult } from '../../shared/index.ts'
import { BackLink } from '../../ui/BackLink.tsx'
import { Button } from '../../ui/Button.tsx'
import { buttonClass } from '../../ui/classes.ts'
import { EmptyState } from '../../ui/EmptyState.tsx'
import { PageSkeleton, Skeleton } from '../../ui/Skeleton.tsx'
import { formatClock } from './format.ts'
import { GAME_COMPONENTS } from './gameModules.ts'
import { GameSummary } from './GameSummary.tsx'
import { loadVariant, saveVariant } from './prefs.ts'
import type { GameOutcome, GamePlayProps } from './types.ts'
import { useGameScope } from './useGameScope.ts'

interface Run {
  words: GamePlayProps['words']
  pool: GamePlayProps['pool']
  turns: GamePlayProps['turns']
  pick: PickOptions
  dayStartHour: number
}

interface Finished {
  outcome: GameOutcome
  previous: GameResult | undefined
  isRecord: boolean
}

type Phase = { name: 'setup' } | { name: 'play'; run: Run } | { name: 'summary'; finished: Finished }

/** Placeholder while the code of a game downloads: same frame as the game itself, so the screen does not jump. */
function GameLoading() {
  return (
    <div role="status" aria-label="Cargando el juego" className="fixed inset-0 z-50 space-y-3 bg-bg px-4 pt-16">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

/** A game from setup to summary: choose the version, play, and see the result and the record. */
export default function GamePage() {
  const { gameId = '' } = useParams()
  const info = gameInfo(gameId)
  const navigate = useNavigate()
  const { scope, includeNew, search } = useGameScope()
  const { settings } = useDeviceSettings()
  const [data, setData] = useState<GameData | undefined>(undefined)
  const [reload, setReload] = useState(0)
  const [variant, setVariant] = useState(() => (info ? resolveVariant(info, loadVariant(info.id)) : ''))
  const [phase, setPhase] = useState<Phase>({ name: 'setup' })
  const [best, setBest] = useState<GameResult | undefined>(undefined)

  // The data is read when the page opens and again after each game, never during one.
  useEffect(() => {
    let alive = true
    void loadGameData().then((fresh) => {
      if (alive) setData(fresh)
    })
    return () => {
      alive = false
    }
  }, [reload])

  const gameKey = info?.id
  useEffect(() => {
    if (!gameKey) return
    let alive = true
    void loadBestResult(gameKey, variant).then((result) => {
      if (alive) setBest(result)
    })
    return () => {
      alive = false
    }
  }, [gameKey, variant, phase.name])

  const inScope = useMemo(() => (data ? wordsInScope(data.words, scope, includeNew) : []), [data, scope, includeNew])

  const begin = async (source: GameData) => {
    if (!info) return
    primeSpeech()
    const turns = await loadGameTurns(info.id)
    const words = wordsInScope(source.words, scope, includeNew)
    setPhase({
      name: 'play',
      run: {
        words,
        pool: source.words.map((word) => word.entry),
        turns,
        pick: {
          now: Date.now(),
          desiredRetention: source.desiredRetention,
          failedAt: source.failedAt,
          rng: Math.random,
          ...(scope.kind === 'focus' ? { focusIds: new Set(scope.entryIds) } : {}),
        },
        dayStartHour: source.dayStartHour,
      },
    })
  }

  const record = useCallback(
    (answer: GameAnswer) => {
      if (!info || phase.name !== 'play') return
      void recordGameAnswer(info.id, answer, { prefer: info.card, dayStartHour: phase.run.dayStartHour }).catch(() => undefined)
    },
    [info, phase],
  )

  const finish = async (outcome: GameOutcome) => {
    if (!info) return
    const previous = await loadBestResult(info.id, variant)
    const saved = await saveGameResult({ game: info.id, score: outcome.score, total: outcome.total, durationMs: outcome.durationMs, variant })
    setPhase({ name: 'summary', finished: { outcome, previous, isRecord: !previous || isBetterResult(info.id, saved, previous) } })
  }

  const backToSetup = () => {
    setPhase({ name: 'setup' })
    setReload((count) => count + 1)
  }
  const again = async () => {
    const fresh = await loadGameData()
    setData(fresh)
    await begin(fresh)
  }

  if (!info || !info.ready) {
    return (
      <>
        <BackLink to="/games" label="Juegos" />
        <EmptyState
          icon={SearchX}
          title={info ? 'Este juego llega pronto' : 'No encuentro este juego'}
          action={
            <Link to="/games" className={buttonClass('primary')}>
              Ver los juegos
            </Link>
          }
        >
          {info ? 'Está previsto para una de las próximas versiones.' : 'Revisa la dirección o elige uno de la lista.'}
        </EmptyState>
      </>
    )
  }

  if (phase.name === 'play') {
    const Game = GAME_COMPONENTS[info.id]
    if (!Game) return null
    return (
      <Suspense fallback={<GameLoading />}>
        <Game
          words={phase.run.words}
          pool={phase.run.pool}
          turns={phase.run.turns}
          variant={variant}
          pick={phase.run.pick}
          autoPlayAudio={settings.autoPlayAudio}
          record={record}
          onFinish={(outcome) => void finish(outcome)}
          onExit={backToSetup}
        />
      </Suspense>
    )
  }

  const variantLabel = info.variants?.options.find((option) => option.value === variant)?.label
  if (phase.name === 'summary') {
    return (
      <GameSummary
        info={info}
        variantLabel={variantLabel}
        outcome={phase.finished.outcome}
        previous={phase.finished.previous}
        isRecord={phase.finished.isRecord}
        onAgain={() => void again()}
        onExit={() => navigate(`/games${search}`)}
      />
    )
  }

  if (data === undefined) return <PageSkeleton />

  const found = availability(info, inScope, variant)
  const choose = (value: string) => {
    setVariant(value)
    saveVariant(info.id, value)
  }

  return (
    <>
      <BackLink to={`/games${search}`} label="Juegos" />
      <header className="mt-2">
        <h1 className="text-title font-semibold tracking-tight">{info.name}</h1>
        <p className="mt-1 text-secondary text-text-2">{info.blurb}</p>
      </header>

      {info.variants ? (
        <section aria-label="Versión" className="mt-5">
          <h2 className="mb-1.5 px-1 text-caption font-medium uppercase tracking-wider text-text-3">Versión</h2>
          <div role="radiogroup" aria-label="Versión" className="grid gap-2">
            {info.variants.options.map((option) => {
              const selected = option.value === variant
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => choose(option.value)}
                  className={`flex min-h-12 items-center justify-between gap-3 rounded-card border px-3 text-left transition-colors motion-reduce:transition-none ${selected ? 'border-accent bg-accent/15' : 'border-border bg-surface active:bg-surface-2'}`}
                >
                  <span className={selected ? 'text-accent' : ''}>{option.label}</span>
                  {option.hint ? <span className="text-secondary text-text-3">{option.hint}</span> : null}
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      <section aria-label="Resumen" className="mt-5 space-y-2 rounded-card border border-border bg-surface p-3 text-secondary text-text-2">
        <p>
          {describeScope(scope, data.topics, data.sources)} · {found.playable === 1 ? '1 palabra sirve' : `${found.playable} palabras sirven`} para este juego
        </p>
        {best ? (
          <p className="flex items-center gap-1.5">
            <Trophy size={14} className="text-hard" aria-hidden="true" />
            Tu récord: {info.id === 'match' ? formatClock(best.durationMs) : `${best.score} de ${best.total}`}
          </p>
        ) : null}
        {scope.kind === 'focus' ? <p>Las palabras que has fallado van primero y otras que ya conoces completan la partida.</p> : null}
      </section>

      <div className="mt-5">
        {found.open ? (
          <Button variant="primary" className="h-12 w-full text-[16px]" onClick={() => void begin(data)}>
            Empezar
          </Button>
        ) : (
          <>
            <p className="rounded-card border border-hard/40 bg-hard/10 px-3 py-2 text-hard">Necesitas {found.min} palabras para jugar</p>
            <Link to={`/games${search}`} className={buttonClass('secondary', 'mt-3 w-full')}>
              Cambiar el alcance
            </Link>
          </>
        )}
      </div>
    </>
  )
}
