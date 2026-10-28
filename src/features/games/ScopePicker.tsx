import { useMemo } from 'react'
import { ALL_WORDS, type GameScope } from '../../games/scope.ts'
import { wordsInScope, type GameWord } from '../../games/words.ts'
import type { Source, Topic } from '../../shared/index.ts'
import { Switch, SelectField } from '../../ui/controls.tsx'

type Kind = GameScope['kind']

const KINDS: ReadonlyArray<{ kind: Exclude<Kind, 'focus'>; label: string }> = [
  { kind: 'all', label: 'Todo' },
  { kind: 'topic', label: 'Tema' },
  { kind: 'source', label: 'Fuente' },
  { kind: 'leeches', label: 'Rebeldes' },
  { kind: 'recent', label: 'Últimas añadidas' },
]

interface ScopePickerProps {
  scope: GameScope
  includeNew: boolean
  words: readonly GameWord[]
  topics: readonly Topic[]
  sources: readonly Source[]
  /** Words in the scope, to say how many there are. */
  count: number
  onScope: (scope: GameScope) => void
  onIncludeNew: (value: boolean) => void
}

/** The scope chips of spec §8 (everything, a topic, a series, the rebels, the latest added), with the topic or series chosen below. */
export function ScopePicker({ scope, includeNew, words, topics, sources, count, onScope, onIncludeNew }: ScopePickerProps) {
  const usable = useMemo(() => wordsInScope(words, ALL_WORDS, includeNew), [words, includeNew])
  const topicChoices = useMemo(
    () =>
      topics
        .map((topic) => ({ topic, count: usable.filter((word) => word.entry.topicIds.includes(topic.id)).length }))
        .sort((a, b) => b.count - a.count || a.topic.nameEs.localeCompare(b.topic.nameEs, 'es')),
    [topics, usable],
  )
  const sourceChoices = useMemo(
    () =>
      sources
        .map((source) => ({ source, count: usable.filter((word) => word.entry.contexts.some((context) => context.sourceId === source.id)).length }))
        .sort((a, b) => b.count - a.count || a.source.title.localeCompare(b.source.title, 'es')),
    [sources, usable],
  )

  const choose = (kind: Exclude<Kind, 'focus'>) => {
    if (kind === 'topic') {
      const first = topicChoices[0]
      onScope(first ? { kind, topicId: first.topic.id } : ALL_WORDS)
    } else if (kind === 'source') {
      const first = sourceChoices[0]
      onScope(first ? { kind, sourceId: first.source.id } : ALL_WORDS)
    } else {
      onScope(kind === 'all' ? ALL_WORDS : { kind })
    }
  }

  return (
    <section aria-label="Alcance" className="space-y-3">
      {scope.kind === 'focus' ? (
        <div className="flex items-center justify-between gap-3 rounded-card border border-again/40 bg-again/10 px-3 py-2">
          <p className="text-secondary text-again">
            {scope.entryIds.length === 1 ? 'Jugando con la palabra que has fallado' : `Jugando con las ${scope.entryIds.length} palabras que has fallado`}, y otras que ya conoces para completar.
          </p>
          <button type="button" onClick={() => onScope(ALL_WORDS)} className="min-h-11 shrink-0 px-2 text-secondary text-text-2 underline underline-offset-2">
            Quitar
          </button>
        </div>
      ) : (
        <div role="group" aria-label="Qué palabras" className="flex flex-wrap gap-2">
          {KINDS.map(({ kind, label }) => {
            const selected = scope.kind === kind
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={selected}
                onClick={() => choose(kind)}
                className={`inline-flex min-h-11 items-center rounded-control border px-3 text-body transition-colors motion-reduce:transition-none ${selected ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-surface text-text-2 active:bg-surface-2'}`}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {scope.kind === 'topic' ? (
        topicChoices.length > 0 ? (
          <SelectField
            label="Tema"
            value={scope.topicId}
            options={topicChoices.map(({ topic, count: n }) => ({ value: topic.id, label: `${topic.emoji} ${topic.nameEs} (${n})` }))}
            onChange={(topicId) => onScope({ kind: 'topic', topicId })}
          />
        ) : (
          <p className="text-secondary text-text-3">Todavía no tienes temas.</p>
        )
      ) : null}
      {scope.kind === 'source' ? (
        sourceChoices.length > 0 ? (
          <SelectField
            label="Fuente"
            value={scope.sourceId}
            options={sourceChoices.map(({ source, count: n }) => ({ value: source.id, label: `${source.title} (${n})` }))}
            onChange={(sourceId) => onScope({ kind: 'source', sourceId })}
          />
        ) : (
          <p className="text-secondary text-text-3">Todavía no tienes series ni películas.</p>
        )
      ) : null}

      <div className="flex min-h-12 items-center justify-between gap-3 rounded-card border border-border bg-surface px-3">
        <div className="min-w-0">
          <div className="text-body">Incluir palabras sin repasar</div>
          <div className="text-secondary text-text-3">Por defecto solo juegas con las que ya has visto en el repaso.</div>
        </div>
        <Switch checked={includeNew} onChange={onIncludeNew} label="Incluir palabras sin repasar" />
      </div>

      <p className="text-secondary text-text-2" aria-live="polite">
        {count === 1 ? '1 palabra con este alcance' : `${count} palabras con este alcance`}
      </p>
    </section>
  )
}
