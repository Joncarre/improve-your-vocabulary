import { AlertTriangle, Check, Clock, Copy } from 'lucide-react'
import { useId, useState } from 'react'
import { AI_LIMITS, type Source } from '../../shared/index.ts'
import { Button } from '../../ui/Button.tsx'
import { parseBatchList, processBatchItem, runQueue, type BatchItem, type BatchOutcome } from './batch.ts'

type RowState = { phase: 'waiting' } | { phase: 'working' } | ({ phase: 'done' } & BatchOutcome)

const INPUT =
  'h-10 w-full min-w-0 rounded-control border border-border bg-surface-2 px-3 text-text placeholder:text-text-3'

function RowIcon({ row }: { row: RowState }) {
  if (row.phase === 'waiting') return <span className="size-4 rounded-full border border-border" aria-hidden="true" />
  // A soft pulse and not a spinner (spec §12): the row also says "Analizando…".
  if (row.phase === 'working') return <span className="size-4 animate-pulse rounded-full bg-accent/60 motion-reduce:animate-none" aria-hidden="true" />
  switch (row.status) {
    case 'saved':
      return <Check size={16} className="text-good" aria-hidden="true" />
    case 'duplicate':
      return <Copy size={16} className="text-easy" aria-hidden="true" />
    case 'pending':
      return <Clock size={16} className="text-hard" aria-hidden="true" />
    default:
      return <AlertTriangle size={16} className="text-again" aria-hidden="true" />
  }
}

function rowLabel(row: RowState): string {
  if (row.phase === 'waiting') return 'En cola'
  if (row.phase === 'working') return 'Analizando…'
  if (row.status === 'saved') return 'Guardada'
  return row.message ?? ''
}

interface AddBatchProps {
  secret: string
  sources: Source[]
  initialSource: string
  initialDetail: string
  /** Back to the single-word form. */
  onBack: () => void
  /** Close the sheet once the list has been handled. */
  onDone: () => void
}

/** Paste a list (one word per line, optionally "word — sentence") and let the queue add them 2 at a time. */
export function AddBatch({ secret, sources, initialSource, initialDetail, onBack, onDone }: AddBatchProps) {
  const sourcesId = useId()
  const [text, setText] = useState('')
  const [source, setSource] = useState(initialSource)
  const [detail, setDetail] = useState(initialDetail)
  const [items, setItems] = useState<BatchItem[]>([])
  const [rows, setRows] = useState<RowState[]>([])
  const [running, setRunning] = useState(false)

  const parsed = parseBatchList(text)
  const finished = rows.filter((row) => row.phase === 'done').length
  const started = items.length > 0

  const start = async () => {
    const list = parsed
    if (list.length === 0) return
    setItems(list)
    setRows(list.map(() => ({ phase: 'waiting' })))
    setRunning(true)
    const update = (index: number, row: RowState) => setRows((current) => current.map((old, i) => (i === index ? row : old)))
    await runQueue(list, async (item, index) => {
      update(index, { phase: 'working' })
      try {
        const outcome = await processBatchItem(item, {
          secret,
          ...(source.trim() ? { sourceTitle: source.trim() } : {}),
          ...(detail.trim() ? { detail: detail.trim() } : {}),
        })
        update(index, { phase: 'done', ...outcome })
      } catch {
        update(index, { phase: 'done', status: 'failed', message: 'No se pudo guardar' })
      }
    })
    setRunning(false)
  }

  if (started) {
    return (
      <div>
        <p className="mb-2 text-secondary text-text-2" aria-live="polite">
          {running ? `Procesando… ${finished} de ${items.length}` : `Listo: ${items.length} palabras procesadas`}
        </p>
        <div
          className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={finished}
        >
          <div className="h-full bg-accent transition-[width]" style={{ width: `${(finished / items.length) * 100}%` }} />
        </div>
        <ul className="divide-y divide-border rounded-card border border-border">
          {items.map((item, index) => {
            const row = rows[index] ?? { phase: 'waiting' as const }
            return (
              <li key={`${item.word}-${index}`} className="flex items-center gap-3 px-3 py-2">
                <RowIcon row={row} />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{item.word}</div>
                  <div className="truncate text-caption text-text-3">{rowLabel(row)}</div>
                </div>
              </li>
            )
          })}
        </ul>
        <Button variant="primary" className="mt-4 w-full" onClick={onDone}>
          {running ? 'Seguir en segundo plano' : 'Hecho'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-caption text-text-2">Una palabra por línea (opcional: palabra — frase)</span>
        <textarea
          autoFocus
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={'knackered\nwent — We went to the pub.\ncheers'}
          className={`${INPUT} h-auto resize-none py-2 leading-snug`}
        />
      </label>
      <div className="grid grid-cols-[3fr_2fr] gap-2">
        <label className="block">
          <span className="mb-1 block text-caption text-text-2">Serie o película</span>
          <input
            list={sourcesId}
            maxLength={AI_LIMITS.sourceMax}
            value={source}
            onChange={(event) => setSource(event.target.value)}
            autoCorrect="off"
            spellCheck={false}
            className={INPUT}
          />
          <datalist id={sourcesId}>
            {sources.map((candidate) => (
              <option key={candidate.id} value={candidate.title} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="mb-1 block text-caption text-text-2">Detalle</span>
          <input
            maxLength={40}
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            autoCorrect="off"
            spellCheck={false}
            className={INPUT}
          />
        </label>
      </div>
      <Button variant="primary" className="w-full" disabled={parsed.length === 0} onClick={() => void start()}>
        {parsed.length > 0 ? `Añadir ${parsed.length} ${parsed.length === 1 ? 'palabra' : 'palabras'}` : 'Añadir'}
      </Button>
      <button type="button" onClick={onBack} className="mx-auto block h-11 text-secondary text-text-2">
        Añadir una sola
      </button>
    </div>
  )
}
