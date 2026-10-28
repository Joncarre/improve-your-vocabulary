import { ClipboardPaste } from 'lucide-react'
import { useId, type FormEvent } from 'react'
import type { MarathonDefaults } from './save.ts'
import { AI_LIMITS, type Source } from '../../shared/index.ts'
import { Button } from '../../ui/Button.tsx'

export interface FormValues {
  word: string
  sentence: string
  source: string
  detail: string
}

const INPUT =
  'h-10 w-full min-w-0 rounded-control border border-border bg-surface-2 px-3 text-text placeholder:text-text-3'

interface AddFormProps {
  values: FormValues
  onChange: (values: FormValues) => void
  sources: Source[]
  marathon: MarathonDefaults | undefined
  onSubmit: () => void
  onBatch: () => void
}

export function AddForm({ values, onChange, sources, marathon, onSubmit, onBatch }: AddFormProps) {
  const sourcesId = useId()
  const set = (patch: Partial<FormValues>) => onChange({ ...values, ...patch })

  const paste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim()
      if (text) set({ sentence: text.slice(0, AI_LIMITS.sentenceMax) })
    } catch {
      // The browser refused to read the clipboard: the user can paste with the keyboard.
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-caption text-text-2">Palabra o expresión</span>
        <input
          autoFocus
          required
          maxLength={AI_LIMITS.wordMax}
          value={values.word}
          onChange={(event) => set({ word: event.target.value })}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder="went, knackered, go off on one…"
          className={INPUT}
        />
      </label>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="add-sentence" className="text-caption text-text-2">
            Frase donde la encontré
          </label>
          <button
            type="button"
            onClick={() => void paste()}
            className="-my-3 flex h-11 items-center gap-1 px-1 text-caption text-accent"
          >
            <ClipboardPaste size={14} aria-hidden="true" />
            Pegar
          </button>
        </div>
        <textarea
          id="add-sentence"
          rows={2}
          maxLength={AI_LIMITS.sentenceMax}
          value={values.sentence}
          onChange={(event) => set({ sentence: event.target.value })}
          spellCheck={false}
          placeholder="We went to the pub after work."
          className={`${INPUT} h-auto resize-none py-2 leading-snug`}
        />
      </div>

      <div className="grid grid-cols-[3fr_2fr] gap-2">
        <label className="block">
          <span className="mb-1 block text-caption text-text-2">Serie o película</span>
          <input
            list={sourcesId}
            maxLength={AI_LIMITS.sourceMax}
            value={values.source}
            onChange={(event) => set({ source: event.target.value })}
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            className={INPUT}
          />
          <datalist id={sourcesId}>
            {sources.map((source) => (
              <option key={source.id} value={source.title} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="mb-1 block text-caption text-text-2">Detalle</span>
          <input
            maxLength={40}
            value={values.detail}
            onChange={(event) => set({ detail: event.target.value })}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="T2 E5"
            className={INPUT}
          />
        </label>
      </div>
      {marathon ? (
        <p className="text-caption text-text-3">
          Misma fuente que tu última palabra (hace {marathon.minutesAgo} min).
        </p>
      ) : null}

      <Button type="submit" variant="primary" className="w-full" disabled={!values.word.trim()}>
        Analizar
      </Button>
      <button type="button" onClick={onBatch} className="mx-auto block h-11 text-secondary text-text-2">
        Añadir varias a la vez
      </button>
    </form>
  )
}
