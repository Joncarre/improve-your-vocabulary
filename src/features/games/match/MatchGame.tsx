import { useEffect, useRef, useState } from 'react'
import { playAudio } from '../../../audio/useSpeech.ts'
import { isPair, MATCH_PAIRS, planMatch, type MatchBoard, type MatchTile, type MatchVariant } from '../../../games/match.ts'
import { formatClock } from '../format.ts'
import { GameShell } from '../GameShell.tsx'
import { clock } from '../dom.ts'
import { NothingToPlay } from '../parts.tsx'
import { useFitText } from '../useFitText.ts'
import type { GamePlayProps } from '../types.ts'

/** How long a wrong pair stays red before the tiles can be tapped again. */
const WRONG_FLASH_MS = 650
/** The last pair stays on screen a moment before the result. */
const FINISH_DELAY_MS = 900

type TileState = 'idle' | 'selected' | 'matched' | 'wrong'

const TILE_STATES: Record<TileState, string> = {
  idle: 'border-border bg-surface active:bg-surface-2',
  selected: 'border-accent bg-accent/15 ring-2 ring-accent',
  matched: 'border-good/50 bg-good/15 text-good',
  wrong: 'border-again bg-again/15',
}

/** The biggest size of the text of a tile; `useFitText` shrinks it until a long definition or an expression fits (11 px at the least, spec §12). */
const TILE_FONT = { word: 22, other: 18 }

function Tile({ tile, state, onTap }: { tile: MatchTile; state: TileState; onTap: () => void }) {
  const { box, text } = useFitText<HTMLButtonElement, HTMLSpanElement>(tile.text, TILE_FONT[tile.side])
  return (
    <button
      ref={box}
      type="button"
      title={tile.text}
      aria-pressed={state === 'selected'}
      disabled={state === 'matched'}
      onClick={onTap}
      className={`flex h-full min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-card border p-2 text-center leading-tight transition-colors motion-reduce:transition-none ${TILE_STATES[state]} ${
        tile.kind === 'ipa' ? 'ipa' : tile.side === 'word' ? 'font-serif font-medium' : ''
      }`}
    >
      <span ref={text} className="block w-full [-webkit-box-orient:vertical] overflow-hidden">
        {tile.text}
      </span>
      {state === 'matched' ? <span className="sr-only"> (emparejada)</span> : null}
    </button>
  )
}

/** Time since the game began, updated four times a second until it stops. */
function useStopwatch(running: boolean, startedAt: number): number {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setElapsed(clock() - startedAt), 250)
    return () => window.clearInterval(timer)
  }, [running, startedAt])
  return elapsed
}

function Board({ board, autoPlayAudio, record, onFinish, onExit }: { board: MatchBoard } & Pick<GamePlayProps, 'autoPlayAudio' | 'record' | 'onFinish' | 'onExit'>) {
  const [selected, setSelected] = useState<string | null>(null)
  const [matched, setMatched] = useState<ReadonlySet<string>>(new Set())
  const [wrong, setWrong] = useState<readonly string[]>([])
  const [finalMs, setFinalMs] = useState<number | null>(null)
  const [startedAt] = useState(clock)
  const lastMatchAt = useRef(startedAt)
  // Words with a mistake: both tiles of a wrong pair count against their words.
  const missed = useRef(new Set<string>())
  const timers = useRef<number[]>([])
  const elapsed = useStopwatch(finalMs === null, startedAt)

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const tap = (tile: MatchTile) => {
    if (wrong.length > 0 || finalMs !== null || matched.has(tile.entryId)) return
    if (selected === tile.id) {
      setSelected(null)
      return
    }
    const first = board.tiles.find((candidate) => candidate.id === selected)
    // Two tiles of the same side can never be a pair: the tap just moves the selection.
    if (!first || first.side === tile.side) {
      setSelected(tile.id)
      return
    }

    if (!isPair(first, tile)) {
      missed.current.add(first.entryId)
      missed.current.add(tile.entryId)
      setSelected(null)
      setWrong([first.id, tile.id])
      timers.current.push(window.setTimeout(() => setWrong([]), WRONG_FLASH_MS))
      return
    }

    const now = clock()
    record({ entryId: tile.entryId, correct: !missed.current.has(tile.entryId), ms: now - lastMatchAt.current })
    lastMatchAt.current = now
    const entry = board.entries.find((candidate) => candidate.id === tile.entryId)
    if (autoPlayAudio && entry) playAudio({ key: 'game-match', text: entry.lemma, audioUrl: entry.audioUrl })

    const next = new Set(matched).add(tile.entryId)
    setMatched(next)
    setSelected(null)
    if (next.size === MATCH_PAIRS) {
      const durationMs = now - startedAt
      setFinalMs(durationMs)
      const missedWords = board.entries.filter((candidate) => missed.current.has(candidate.id))
      timers.current.push(window.setTimeout(() => onFinish({ score: MATCH_PAIRS - missedWords.length, total: MATCH_PAIRS, durationMs, missed: missedWords }), FINISH_DELAY_MS))
    }
  }

  const stateOf = (tile: MatchTile): TileState =>
    matched.has(tile.entryId) ? 'matched' : wrong.includes(tile.id) ? 'wrong' : selected === tile.id ? 'selected' : 'idle'

  return (
    <GameShell label="Parejas" progress={matched.size / MATCH_PAIRS} counter={`${matched.size} de ${MATCH_PAIRS} parejas`} right={formatClock(finalMs ?? elapsed)} onExit={onExit}>
      <div className="mx-auto min-h-0 w-full max-w-[560px] flex-1 px-4 pb-1">
        <div className="grid h-full max-h-[680px] grid-cols-3 grid-rows-4 gap-2">
          {board.tiles.map((tile) => (
            <Tile key={tile.id} tile={tile} state={stateOf(tile)} onTap={() => tap(tile)} />
          ))}
        </div>
      </div>
    </GameShell>
  )
}

/** Parejas (spec §8): twelve tiles, six pairs, against the clock. */
export default function MatchGame({ words, variant, pick, autoPlayAudio, record, onFinish, onExit }: GamePlayProps) {
  const matchVariant: MatchVariant = variant === 'definition' || variant === 'ipa' ? variant : 'es'
  const [board] = useState(() => planMatch(words, matchVariant, pick))
  if (!board) {
    return (
      <GameShell label="Parejas" progress={0} counter="" onExit={onExit}>
        <NothingToPlay onExit={onExit} />
      </GameShell>
    )
  }
  return <Board board={board} autoPlayAudio={autoPlayAudio} record={record} onFinish={onFinish} onExit={onExit} />
}
