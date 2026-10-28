import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { listActive } from '../../db/repo.ts'
import type { Cefr, Entry, EntryKind } from '../../shared/index.ts'
import { Button } from '../../ui/Button.tsx'
import { ModalSheet } from '../../ui/ModalSheet.tsx'
import { showToast } from '../../ui/toastStore.ts'
import { saveEntryEdits } from './actions.ts'
import { AreaField, EditorCard, EditorGroup, SelectInput, TextField } from './editorFields.tsx'
import { draftToEntry, entryToDraft, type EditorDraft } from './editorModel.ts'
import { FamilyEditor, FormsEditor, SensesEditor } from './EditorSenses.tsx'

const KIND_CHOICES: Array<{ value: EntryKind; label: string }> = [
  { value: 'word', label: 'Palabra' },
  { value: 'phrasal_verb', label: 'Phrasal verb' },
  { value: 'idiom', label: 'Modismo' },
  { value: 'expression', label: 'Expresión' },
]
const CEFR_CHOICES: Array<{ value: Cefr | ''; label: string }> = [
  { value: '', label: 'Sin nivel' },
  ...(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((level) => ({ value: level, label: level })),
]
const MAX_TOPICS = 2

/** Edits everything on the entry; nothing is saved until "Guardar". */
export function EntryEditor({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const [draft, setDraft] = useState<EditorDraft>(() => entryToDraft(entry))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const topics = useLiveQuery(() => listActive('topics'), [], [])

  const patch = (change: Partial<EditorDraft>) => setDraft((current) => ({ ...current, ...change }))

  const toggleTopic = (id: string) =>
    patch({
      topicIds: draft.topicIds.includes(id) ? draft.topicIds.filter((other) => other !== id) : [...draft.topicIds, id],
    })

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const result = await saveEntryEdits(draftToEntry(entry, draft))
      if (result.ok) {
        showToast('Cambios guardados')
        onClose()
      } else {
        setError(result.message)
      }
    } catch {
      setError('No se han podido guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalSheet
      title="Editar palabra"
      onClose={onClose}
      footer={
        <div>
          {error ? (
            <p role="alert" className="mb-2 text-secondary text-again">
              {error}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={onClose}>Cancelar</Button>
            <Button variant="primary" disabled={saving || !draft.lemma.trim()} onClick={() => void save()}>
              Guardar
            </Button>
          </div>
        </div>
      }
    >
      <EditorGroup title="Palabra">
        <TextField label="Palabra o expresión" lang="en" value={draft.lemma} onChange={(lemma) => patch({ lemma })} />
        <TextField label="Pronunciación (IPA británica)" value={draft.ipa} onChange={(ipa) => patch({ ipa })} placeholder="/ɡəʊ/" />
        <div className="grid grid-cols-2 gap-2">
          <SelectInput<EntryKind> label="Clase" value={draft.kind} options={KIND_CHOICES} onChange={(kind) => patch({ kind })} />
          <SelectInput<Cefr | ''> label="Nivel" value={draft.cefr} options={CEFR_CHOICES} onChange={(cefr) => patch({ cefr })} />
        </div>
      </EditorGroup>

      <SensesEditor draft={draft} patch={patch} />
      <FormsEditor draft={draft} patch={patch} />
      <FamilyEditor draft={draft} patch={patch} />

      <EditorGroup title="Sinónimos, antónimos y colocaciones">
        <TextField label="Sinónimos (separados por comas)" lang="en" value={draft.synonyms} onChange={(synonyms) => patch({ synonyms })} />
        <TextField label="Antónimos" lang="en" value={draft.antonyms} onChange={(antonyms) => patch({ antonyms })} />
        <TextField label="Colocaciones" lang="en" value={draft.collocations} onChange={(collocations) => patch({ collocations })} />
      </EditorGroup>

      <EditorGroup title="Notas">
        <AreaField label="Nota para hispanohablantes" lang="es" rows={3} value={draft.learnerNote} onChange={(learnerNote) => patch({ learnerNote })} />
        <AreaField label="Británico y americano" lang="es" rows={3} value={draft.usNote} onChange={(usNote) => patch({ usNote })} />
      </EditorGroup>

      <EditorGroup title="Temas">
        {topics.length === 0 ? (
          <p className="text-secondary text-text-2">Todavía no hay temas.</p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2">
              {topics.map((topic) => {
                const selected = draft.topicIds.includes(topic.id)
                const blocked = !selected && draft.topicIds.length >= MAX_TOPICS
                return (
                  <li key={topic.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      disabled={blocked}
                      onClick={() => toggleTopic(topic.id)}
                      className={`inline-flex min-h-11 items-center gap-1.5 rounded-chip border px-3 disabled:opacity-40 ${
                        selected ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface-2 text-text-2'
                      }`}
                    >
                      <span aria-hidden="true">{topic.emoji}</span>
                      {topic.nameEs}
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="text-caption text-text-3">Hasta {MAX_TOPICS} temas por palabra.</p>
          </>
        )}
      </EditorGroup>

      {draft.contexts.length > 0 ? (
        <EditorGroup title="Dónde la viste">
          {draft.contexts.map((context, index) => (
            <EditorCard
              key={context.id}
              title={`Frase ${index + 1}`}
              onRemove={() => patch({ contexts: draft.contexts.filter((_, i) => i !== index) })}
            >
              <AreaField
                label="Frase"
                lang="en"
                value={context.sentence}
                onChange={(sentence) =>
                  patch({ contexts: draft.contexts.map((item, i) => (i === index ? { ...item, sentence } : item)) })
                }
              />
              <TextField
                label="Traducción"
                lang="es"
                value={context.translationEs ?? ''}
                onChange={(translationEs) =>
                  patch({ contexts: draft.contexts.map((item, i) => (i === index ? { ...item, translationEs } : item)) })
                }
              />
            </EditorCard>
          ))}
        </EditorGroup>
      ) : null}
    </ModalSheet>
  )
}
