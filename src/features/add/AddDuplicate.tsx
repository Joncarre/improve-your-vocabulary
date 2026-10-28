import { useState } from 'react'
import { POS_LABEL_ES, posTone } from '../../lib/pos.ts'
import type { Entry } from '../../shared/index.ts'
import { Button } from '../../ui/Button.tsx'
import { Chip } from '../../ui/Chip.tsx'
import type { DraftSense } from './draft.ts'

interface AddDuplicateProps {
  entry: Entry
  /** The sentence typed in the form, if any. */
  sentence: string
  /** A sense the sentence uses that the entry does not have yet. */
  newSense: DraftSense | undefined
  /** The sentence is already one of the entry's contexts. */
  sentenceKnown: boolean
  onAdd: (includeSense: boolean) => void
  onClose: () => void
}

export function AddDuplicate({ entry, sentence, newSense, sentenceKnown, onAdd, onClose }: AddDuplicateProps) {
  const [includeSense, setIncludeSense] = useState(true)
  const first = entry.senses[0]
  const canAdd = Boolean(sentence) && (!sentenceKnown || newSense)

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-border bg-surface-2 p-3">
        <p className="font-serif text-word-entry font-medium">{entry.lemma}</p>
        {entry.ipa ? <p className="ipa text-ipa text-text-2">{entry.ipa}</p> : null}
        {first ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Chip tone={posTone(first.pos)}>{POS_LABEL_ES[first.pos]}</Chip>
            <span className="text-secondary text-text-2">{first.meaningEs}</span>
          </div>
        ) : null}
        <p className="mt-2 text-caption text-text-3">
          {entry.contexts.length === 1 ? '1 frase guardada' : `${entry.contexts.length} frases guardadas`}
          {entry.status === 'pending_ai' ? ' · pendiente de completar' : ''}
        </p>
      </div>

      {sentence && sentenceKnown && !newSense ? (
        <p className="text-secondary text-text-2">Esa frase ya está guardada en la ficha.</p>
      ) : null}

      {newSense ? (
        <label className="flex items-start gap-3 text-secondary">
          <input
            type="checkbox"
            checked={includeSense}
            onChange={(event) => setIncludeSense(event.target.checked)}
            className="mt-0.5 size-5 accent-accent"
          />
          <span>
            Tu frase usa una acepción que la ficha no tiene:{' '}
            <strong className="font-semibold">{newSense.meaningEs || newSense.definitionEn}</strong>. Añadirla también.
          </span>
        </label>
      ) : null}

      <div className="flex flex-col gap-2">
        {canAdd ? (
          <Button variant="primary" onClick={() => onAdd(includeSense && Boolean(newSense))}>
            {sentenceKnown ? 'Añadir la acepción' : 'Añadir la frase como nuevo contexto'}
          </Button>
        ) : null}
        <Button onClick={onClose}>{canAdd ? 'No añadir nada' : 'Cerrar'}</Button>
      </div>
    </div>
  )
}
