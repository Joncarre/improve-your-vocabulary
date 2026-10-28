import { Heart } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { GROUPS, judgeGuess, LINK_KIND_LABEL, PER_GROUP, planConnections, type ConnectionsBoard, type ConnectionsGroup } from '../../../games/connections.ts'
import { shuffle } from '../../../games/rng.ts'
import type { Entry } from '../../../shared/index.ts'
import { Button } from '../../../ui/Button.tsx'
import { GameShell } from '../GameShell.tsx'
import { clock } from '../dom.ts'
import { NothingToPlay } from '../parts.tsx'
import { useFitText } from '../useFitText.ts'
import type { GamePlayProps } from '../types.ts'

/** Lives, as in the original game. */
const LIVES = 4
/** How long a wrong group stays red. */
const WRONG_FLASH_MS = 650

/** Each solved group takes a colour, in the order they are found (the colour is never the only clue: the link is written out). */
const BAND_STYLES = ['border-hard/50 bg-hard/20', 'border-good/50 bg-good/20', 'border-easy/50 bg-easy/20', 'border-adjective/50 bg-adjective/20']

type TileState = 'idle' | 'selected' | 'wrong'

const TILE_STATES: Record<TileState, string> = {
  idle: 'border-border bg-surface active:bg-surface-2',
  selected: 'border-accent bg-accent/15 ring-2 ring-accent',
  wrong: 'border-again bg-again/15',
}

function Tile({ entry, state, onTap }: { entry: Entry; state: TileState; onTap: () => void }) {
  const { box, text } = useFitText<HTMLButtonElement, HTMLSpanElement>(entry.lemma, 17)
  return (
    <button
      ref={box}
      type="button"
      title={entry.lemma}
      aria-pressed={state === 'selected'}
      onClick={onTap}
      className={`flex h-16 min-w-0 items-center justify-center overflow-hidden rounded-card border p-1 text-center font-serif font-medium leading-tight transition-colors motion-reduce:transition-none ${TILE_STATES[state]}`}
    >
      <span ref={text} className="block w-full [-webkit-box-orient:vertical] overflow-hidden">
        {entry.lemma}
      </span>
    </button>
  )
}

/** A group whose link has been found (or, at the end, shown): the link, what kind it is and its four words. */
function Band({ group, style, unsolved = false }: { group: ConnectionsGroup; style: string; unsolved?: boolean }) {
  return (
    <div className={`rounded-card border px-3 py-2 text-center ${style} ${unsolved ? 'border-dashed' : ''}`}>
      <p className="text-caption uppercase tracking-wider text-text-2">
        {LINK_KIND_LABEL[group.link.kind]}
        {unsolved ? ' · sin resolver' : ''}
      </p>
      <p className="text-body font-semibold [overflow-wrap:anywhere]">{group.link.label}</p>
      <p className="mt-0.5 font-serif text-[17px] [overflow-wrap:anywhere]">{group.entries.map((entry) => entry.lemma).join(' · ')}</p>
    </div>
  )
}

function Lives({ left }: { left: number }) {
  return (
    <span role="img" aria-label={`Vidas: ${left} de ${LIVES}`} className="flex items-center gap-1">
      {Array.from({ length: LIVES }, (_, index) => (
        <Heart key={index} size={16} strokeWidth={1.75} aria-hidden="true" className={index < left ? 'fill-again text-again' : 'text-text-3'} />
      ))}
    </span>
  )
}

function Board({ board, record, onFinish, onExit }: { board: ConnectionsBoard } & Pick<GamePlayProps, 'record' | 'onFinish' | 'onExit'>) {
  const [selected, setSelected] = useState<string[]>([])
  const [solved, setSolved] = useState<number[]>([])
  const [lives, setLives] = useState(LIVES)
  const [tiles, setTiles] = useState(board.tiles)
  const [flash, setFlash] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [over, setOver] = useState<'won' | 'lost' | null>(null)
  const [startedAt] = useState(clock)
  const finishedAt = useRef(0)
  const lastAt = useRef(startedAt)
  // Words that were in a wrong group count against their word, even when the group is found afterwards.
  const tangled = useRef(new Set<string>())
  const tried = useRef(new Set<string>())
  const timers = useRef<number[]>([])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const solvedSet = new Set(solved)
  const inSolved = new Set(solved.flatMap((index) => board.groups[index]?.entries.map((entry) => entry.id) ?? []))
  const open = tiles.filter((entry) => !inSolved.has(entry.id))

  const tap = (entry: Entry) => {
    if (over || flash.length > 0) return
    setMessage('')
    setSelected((current) => (current.includes(entry.id) ? current.filter((id) => id !== entry.id) : current.length < PER_GROUP ? [...current, entry.id] : current))
  }

  const lose = () => {
    // Words of the groups that were never found were not known.
    const now = clock()
    board.groups.forEach((group, index) => {
      if (!solvedSet.has(index)) for (const entry of group.entries) record({ entryId: entry.id, correct: false, ms: (now - lastAt.current) / PER_GROUP })
    })
    finishedAt.current = now
    setOver('lost')
  }

  const submit = () => {
    if (over || selected.length !== PER_GROUP) return
    const key = [...selected].sort().join('|')
    if (tried.current.has(key)) {
      setMessage('Esa combinación ya la has probado.')
      return
    }
    const guess = judgeGuess(board, selected, solvedSet)
    if (guess.kind === 'solved') {
      const group = board.groups[guess.group]
      if (!group) return
      const now = clock()
      for (const entry of group.entries) record({ entryId: entry.id, correct: !tangled.current.has(entry.id), ms: (now - lastAt.current) / PER_GROUP })
      lastAt.current = now
      const next = [...solved, guess.group]
      setSolved(next)
      setSelected([])
      setMessage('')
      if (next.length === GROUPS) {
        finishedAt.current = now
        setOver('won')
      }
      return
    }

    tried.current.add(key)
    for (const id of selected) tangled.current.add(id)
    setLives(lives - 1)
    setMessage(guess.kind === 'close' ? 'Casi: tres de las cuatro van juntas.' : 'Esas no van juntas.')
    setFlash(selected)
    setSelected([])
    timers.current.push(window.setTimeout(() => setFlash([]), WRONG_FLASH_MS))
    if (lives - 1 === 0) lose()
  }

  // A new order for the words still in play, to see them differently.
  const shuffleTiles = () => {
    const mixed = shuffle(open, Math.random)
    let at = 0
    setTiles(tiles.map((entry) => (inSolved.has(entry.id) ? entry : (mixed[at++] as Entry))))
  }

  const finish = () => {
    const missed = board.tiles.filter((entry) => tangled.current.has(entry.id) || !board.groups.some((group, index) => solvedSet.has(index) && group.entries.includes(entry)))
    onFinish({ score: solved.length, total: GROUPS, durationMs: finishedAt.current - startedAt, missed })
  }

  const stateOf = (entry: Entry): TileState => (flash.includes(entry.id) ? 'wrong' : selected.includes(entry.id) ? 'selected' : 'idle')
  const unsolved = board.groups.flatMap((group, index) => (solvedSet.has(index) ? [] : [group]))

  return (
    <GameShell label="Conexiones" progress={solved.length / GROUPS} counter={`${solved.length} de ${GROUPS} grupos`} onExit={onExit}>
      <div className="mx-auto min-h-0 w-full max-w-[560px] flex-1 space-y-3 overflow-y-auto px-4 pb-2">
        <p className="text-secondary text-text-2">Junta las palabras que tienen algo en común: son {GROUPS} grupos de {PER_GROUP}.</p>

        {solved.map((index, order) => {
          const group = board.groups[index]
          return group ? <Band key={index} group={group} style={BAND_STYLES[order % BAND_STYLES.length] ?? ''} /> : null
        })}

        {over === 'lost' ? (
          unsolved.map((group, order) => <Band key={group.link.id} group={group} style={BAND_STYLES[(solved.length + order) % BAND_STYLES.length] ?? ''} unsolved />)
        ) : over === 'won' ? null : (
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="Palabras">
            {open.map((entry) => (
              <Tile key={entry.id} entry={entry} state={stateOf(entry)} onTap={() => tap(entry)} />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <Lives left={lives} />
          <p role="status" className="min-h-5 min-w-0 flex-1 text-right text-secondary text-text-2">
            {message}
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[560px] px-4 pt-1">
        {over ? (
          <Button variant="primary" className="h-12 w-full text-[16px]" onClick={finish} autoFocus>
            Ver resultado
          </Button>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <Button className="h-12" onClick={shuffleTiles}>
              Mezclar
            </Button>
            <Button className="h-12" disabled={selected.length === 0} onClick={() => setSelected([])}>
              Soltar
            </Button>
            <Button variant="primary" className="h-12" disabled={selected.length !== PER_GROUP || flash.length > 0} onClick={submit}>
              Comprobar
            </Button>
          </div>
        )}
      </div>
    </GameShell>
  )
}

/** Conexiones (spec §8): sixteen words, four hidden links. */
export default function ConnectionsGame({ words, topics, sources, pick, record, onFinish, onExit }: GamePlayProps) {
  const [board] = useState(() => planConnections(words, topics, sources, pick))
  if (!board) {
    return (
      <GameShell label="Conexiones" progress={0} counter="" onExit={onExit}>
        <NothingToPlay onExit={onExit} />
      </GameShell>
    )
  }
  return <Board board={board} record={record} onFinish={onFinish} onExit={onExit} />
}
