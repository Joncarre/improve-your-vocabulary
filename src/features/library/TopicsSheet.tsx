import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { TOPIC_COLORS } from '../../lib/palette.ts'
import type { Topic } from '../../shared/index.ts'
import { Button } from '../../ui/Button.tsx'
import { ConfirmSheet } from '../../ui/ConfirmSheet.tsx'
import { ModalSheet } from '../../ui/ModalSheet.tsx'
import { showToast } from '../../ui/toastStore.ts'
import { editTopic, firstGrapheme, mergeTopics } from './topics.ts'

/** A few situational emojis to pick from: typing an emoji on a desktop keyboard is awkward. */
const EMOJI_CHOICES = ['🍺', '☕', '🍽️', '🛒', '💼', '🏠', '✈️', '🚆', '🏥', '⚽', '🎬', '📚', '💬', '😡', '❤️', '💰', '🌧️', '👕', '🎓', '🔧']

interface TopicsSheetProps {
  topics: readonly Topic[]
  usage: ReadonlyMap<string, number>
  onClose: () => void
}

const INPUT = 'h-10 w-full min-w-0 rounded-control border border-border bg-surface-2 px-3 text-text'

function TopicEditor({
  topic,
  others,
  usage,
  onDone,
}: {
  topic: Topic
  others: readonly Topic[]
  usage: ReadonlyMap<string, number>
  onDone: () => void
}) {
  const [name, setName] = useState(topic.nameEs)
  const [emoji, setEmoji] = useState(topic.emoji)
  const [color, setColor] = useState(topic.color)
  const [mergeInto, setMergeInto] = useState('')
  const [confirmMerge, setConfirmMerge] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const target = others.find((other) => other.id === mergeInto)
  const words = usage.get(topic.id) ?? 0

  const save = async () => {
    const result = await editTopic(topic.id, { nameEs: name, emoji, color })
    if (result.ok) {
      showToast('Tema guardado')
      onDone()
    } else {
      setError(result.message)
    }
  }

  const merge = async () => {
    if (!target) return
    setConfirmMerge(false)
    const moved = await mergeTopics(topic.id, target.id)
    showToast(`«${topic.nameEs}» fusionado en «${target.nameEs}» (${moved} ${moved === 1 ? 'palabra' : 'palabras'})`)
    onDone()
  }

  return (
    <ModalSheet
      title="Editar tema"
      onClose={onDone}
      footer={
        <div>
          {error ? (
            <p role="alert" className="mb-2 text-secondary text-again">
              {error}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={onDone}>Cancelar</Button>
            <Button variant="primary" disabled={!name.trim()} onClick={() => void save()}>
              Guardar
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pt-2">
        <label className="block">
          <span className="mb-1 block text-caption text-text-2">Nombre</span>
          <input
            value={name}
            maxLength={40}
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
            }}
            className={INPUT}
          />
        </label>

        <fieldset>
          <legend className="mb-1 text-caption text-text-2">Emoji</legend>
          <div className="space-y-2">
            <input
              aria-label="Emoji"
              value={emoji}
              onChange={(event) => setEmoji(firstGrapheme(event.target.value))}
              className={`${INPUT} w-20 text-center text-[20px]`}
            />
            <ul className="flex flex-wrap gap-1">
              {EMOJI_CHOICES.map((choice) => (
                <li key={choice}>
                  <button
                    type="button"
                    aria-label={`Usar ${choice}`}
                    aria-pressed={emoji === choice}
                    onClick={() => setEmoji(choice)}
                    className={`flex size-9 items-center justify-center rounded-control text-[18px] ${
                      emoji === choice ? 'bg-accent/15 ring-1 ring-accent' : 'active:bg-surface-2'
                    }`}
                  >
                    {choice}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-caption text-text-2">Color</legend>
          <ul className="flex flex-wrap gap-2">
            {TOPIC_COLORS.map((choice) => (
              <li key={choice}>
                <button
                  type="button"
                  aria-label={`Color ${choice}`}
                  aria-pressed={color === choice}
                  onClick={() => setColor(choice)}
                  style={{ backgroundColor: choice }}
                  className={`size-9 rounded-full ${color === choice ? 'ring-2 ring-text ring-offset-2 ring-offset-surface' : ''}`}
                />
              </li>
            ))}
          </ul>
        </fieldset>

        {others.length > 0 ? (
          <fieldset className="rounded-card border border-border p-3">
            <legend className="px-1 text-caption text-text-2">Fusionar</legend>
            <p className="mb-2 text-secondary text-text-2">
              Si «{topic.nameEs}» y otro tema son lo mismo, mueve sus {words} {words === 1 ? 'palabra' : 'palabras'} al otro y este desaparece.
            </p>
            <div className="flex gap-2">
              <select
                aria-label="Fusionar con"
                value={mergeInto}
                onChange={(event) => setMergeInto(event.target.value)}
                className={INPUT}
              >
                <option value="">Elige un tema…</option>
                {others.map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.emoji} {other.nameEs}
                  </option>
                ))}
              </select>
              <Button disabled={!target} onClick={() => setConfirmMerge(true)}>
                Fusionar
              </Button>
            </div>
          </fieldset>
        ) : null}
      </div>

      {confirmMerge && target ? (
        <ConfirmSheet
          title="Fusionar temas"
          message={`Las ${words} palabras de «${topic.nameEs}» pasarán a «${target.nameEs}» y «${topic.nameEs}» desaparecerá. No se puede deshacer.`}
          confirmLabel="Fusionar"
          onConfirm={() => void merge()}
          onCancel={() => setConfirmMerge(false)}
        />
      ) : null}
    </ModalSheet>
  )
}

/** All the topics with their words; tap one to rename it, change its emoji or colour, or merge it into another. */
export function TopicsSheet({ topics, usage, onClose }: TopicsSheetProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = topics.find((topic) => topic.id === editingId)
  const sorted = [...topics].sort((a, b) => a.nameEs.localeCompare(b.nameEs, 'es'))

  if (editing) {
    return (
      <TopicEditor
        topic={editing}
        others={sorted.filter((topic) => topic.id !== editing.id)}
        usage={usage}
        onDone={() => setEditingId(null)}
      />
    )
  }

  return (
    <ModalSheet title="Temas" onClose={onClose}>
      {sorted.length === 0 ? (
        <p className="py-6 text-center text-secondary text-text-2">
          Todavía no hay temas. La IA los crea al añadir palabras («En el pub», «En la oficina»…).
        </p>
      ) : (
        <ul className="mt-1 divide-y divide-border overflow-hidden rounded-card border border-border">
          {sorted.map((topic) => {
            const words = usage.get(topic.id) ?? 0
            return (
              <li key={topic.id}>
                <button
                  type="button"
                  onClick={() => setEditingId(topic.id)}
                  className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left active:bg-surface-2"
                >
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: topic.color }}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-[16px]"
                  >
                    {topic.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{topic.nameEs}</span>
                    <span className="block text-caption text-text-3">
                      {words} {words === 1 ? 'palabra' : 'palabras'}
                    </span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-text-3" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </ModalSheet>
  )
}
