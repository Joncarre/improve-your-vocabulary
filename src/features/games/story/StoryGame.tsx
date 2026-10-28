import { CloudOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AiError, requestStory } from '../../../ai/client.ts'
import { loadDeviceSettings } from '../../../db/settings.ts'
import { findReusableStory, storyGaps, storyRequest, weakestWords, type StoryGap } from '../../../games/story.ts'
import { loadStories, saveStory } from '../../../games/storyStore.ts'
import type { Entry, Story } from '../../../shared/index.ts'
import { Button } from '../../../ui/Button.tsx'
import { EmptyState } from '../../../ui/EmptyState.tsx'
import { Skeleton } from '../../../ui/Skeleton.tsx'
import { GameShell } from '../GameShell.tsx'
import type { GamePlayProps } from '../types.ts'
import { StoryGaps } from './StoryGaps.tsx'
import { StoryReading } from './StoryReading.tsx'

interface Ready {
  story: Story
  gaps: StoryGap[]
}

type Load = { name: 'loading' } | { name: 'failed'; message: string; retry: boolean } | ({ name: 'ready' } & Ready)

/** At least this many words must be playable in a story that was kept, or it is not worth reading. */
const MIN_GAPS = 4

/** What the person reads when the story could not be had. */
function describeFailure(error: unknown): { message: string; retry: boolean } {
  if (error instanceof AiError) {
    if (error.code === 'network') return { message: 'Para escribir una historia nueva necesitas conexión. Cuando la tengas, vuelve a intentarlo.', retry: true }
    return { message: error.message, retry: error.retryable }
  }
  return { message: 'No se ha podido preparar la historia.', retry: true }
}

/**
 * The story to play: the last one that was made and not played yet (it costs nothing) or a new one written by the AI
 * with the weakest words and kept straight away.
 */
async function obtainStory(props: Pick<GamePlayProps, 'words' | 'pool' | 'pick'>, signal: AbortSignal): Promise<Ready> {
  const { words, pool, pick } = props
  const reusable = findReusableStory(await loadStories(), new Set(pool.map((entry) => entry.id)), new Set(words.map((word) => word.entry.id)))
  if (reusable) {
    const gaps = storyGaps(reusable, pool)
    if (gaps.length >= MIN_GAPS) return { story: reusable, gaps }
  }

  const entries: Entry[] = weakestWords(words, pick).map((word) => word.entry)
  const { appSecret } = await loadDeviceSettings()
  const output = await requestStory(storyRequest(entries), { secret: appSecret, signal })
  const story = await saveStory(output, entries)
  return { story, gaps: storyGaps(story, pool) }
}

/** Historia (spec §8): read it and listen to it, then put the words back in the gaps. */
export default function StoryGame({ words, pool, pick, record, onFinish, onExit }: GamePlayProps) {
  const [load, setLoad] = useState<Load>({ name: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [phase, setPhase] = useState<'read' | 'gaps'>('read')

  useEffect(() => {
    const controller = new AbortController()
    // The request starts a moment later: a screen that is mounted and unmounted at once (React's strict mode in
    // development) never sends it, and so never spends the AI twice for one story.
    const timer = window.setTimeout(() => {
      void obtainStory({ words, pool, pick }, controller.signal).then(
        (ready) => {
          if (controller.signal.aborted) return
          setLoad(ready.gaps.length >= MIN_GAPS ? { name: 'ready', ...ready } : { name: 'failed', message: 'La historia no ha salido bien. Inténtalo otra vez.', retry: true })
        },
        (error: unknown) => {
          if (!controller.signal.aborted) setLoad({ name: 'failed', ...describeFailure(error) })
        },
      )
    }, 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
    // The words are those of the moment the game began: only a retry asks again.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [attempt])

  const retry = () => {
    setLoad({ name: 'loading' })
    setAttempt((count) => count + 1)
  }

  if (load.name === 'loading') {
    return (
      <GameShell label="Historia" progress={0} counter="Preparando" onExit={onExit}>
        <div role="status" aria-label="Preparando la historia" className="mx-auto w-full max-w-[560px] flex-1 space-y-3 px-4 pt-4">
          <p className="text-body text-text-2">Escribiendo una historia con las palabras que más se te resisten… Suele tardar unos segundos.</p>
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      </GameShell>
    )
  }

  if (load.name === 'failed') {
    return (
      <GameShell label="Historia" progress={0} counter="" onExit={onExit}>
        <div className="mx-auto w-full max-w-[560px] flex-1 px-4">
          <EmptyState
            icon={CloudOff}
            title="No se ha podido preparar la historia"
            action={
              <div className="flex gap-2">
                {load.retry ? (
                  <Button variant="primary" onClick={retry}>
                    Reintentar
                  </Button>
                ) : null}
                <Button onClick={onExit}>Volver</Button>
              </div>
            }
          >
            {load.message}
          </EmptyState>
        </div>
      </GameShell>
    )
  }

  return phase === 'read' ? (
    <StoryReading story={load.story} gaps={load.gaps} onContinue={() => setPhase('gaps')} onExit={onExit} />
  ) : (
    <StoryGaps story={load.story} gaps={load.gaps} rng={pick.rng} record={record} onFinish={onFinish} onExit={onExit} />
  )
}
