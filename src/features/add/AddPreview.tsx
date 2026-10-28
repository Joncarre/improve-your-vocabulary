import { Trash2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { POS_LABEL_ES, POS_OPTIONS, posTone } from '../../lib/pos.ts'
import type { PartOfSpeech, Topic } from '../../shared/index.ts'
import { Button } from '../../ui/Button.tsx'
import { Chip } from '../../ui/Chip.tsx'
import { Highlight } from '../../ui/Highlight.tsx'
import type { EntryDraft } from './draft.ts'

const INPUT =
  'h-10 w-full min-w-0 rounded-control border border-border bg-surface-2 px-3 text-text placeholder:text-text-3'
const MAX_TOPICS = 2

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="mb-1.5 text-caption font-medium uppercase tracking-wider text-text-3">{title}</h3>
      {children}
    </section>
  )
}

interface AddPreviewProps {
  draft: EntryDraft
  topics: Topic[]
  hasSentence: boolean
  onChange: (draft: EntryDraft) => void
  /** Analyse again, this time for the full phrasal verb or expression. */
  onUseUnit: (unit: string) => void
}

/** The editable preview: everything the entry will contain, with the parts that matter editable. */
export function AddPreview({ draft, topics, hasSentence, onChange, onUseUnit }: AddPreviewProps) {
  const set = (patch: Partial<EntryDraft>) => onChange({ ...draft, ...patch })
  const editable = draft.origin !== 'ai'
  const topicById = new Map(topics.map((topic) => [topic.id, topic]))
  const chosenTopics = draft.topicIds.flatMap((id) => topicById.get(id) ?? [])
  const topicCount = chosenTopics.length + (draft.newTopic ? 1 : 0)
  const availableTopics = topics.filter((topic) => !draft.topicIds.includes(topic.id))

  const updateSense = (index: number, patch: Partial<EntryDraft['senses'][number]>) =>
    set({ senses: draft.senses.map((sense, i) => (i === index ? { ...sense, ...patch } : sense)) })
  const verb = draft.forms?.verb
  const noun = draft.forms?.noun
  const adjective = draft.forms?.adjective

  return (
    <div>
      {draft.alternativeUnit ? (
        <div className="mt-1 rounded-card border border-accent/40 bg-accent/10 p-3">
          <p className="text-secondary">
            En tu frase, <strong className="font-semibold">{draft.lemma}</strong> forma parte de{' '}
            <strong className="font-semibold text-accent">{draft.alternativeUnit}</strong>. ¿Cuál quieres guardar?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => onUseUnit(draft.alternativeUnit)}>
              Guardar «{draft.alternativeUnit}»
            </Button>
            <Button onClick={() => set({ alternativeUnit: '' })}>Solo «{draft.lemma}»</Button>
          </div>
        </div>
      ) : null}

      <div className="mt-2">
        <input
          aria-label="Palabra"
          value={draft.lemma}
          onChange={(event) => set({ lemma: event.target.value })}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full min-w-0 bg-transparent font-serif text-word-entry font-medium outline-offset-4"
        />
        <input
          aria-label="Pronunciación (IPA)"
          value={draft.ipa}
          onChange={(event) => set({ ipa: event.target.value })}
          placeholder="/ipa/"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="ipa mt-0.5 w-full min-w-0 bg-transparent text-ipa text-text-2 outline-offset-4 placeholder:text-text-3"
        />
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {[...new Set(draft.senses.map((sense) => sense.pos))].map((pos) => (
            <Chip key={pos} tone={posTone(pos)}>
              {POS_LABEL_ES[pos]}
            </Chip>
          ))}
          {draft.cefr ? <Chip tone="accent">{draft.cefr}</Chip> : null}
          {draft.senses.some((sense) => sense.register === 'slang' || sense.register === 'offensive') ? (
            <Chip tone="again">registro delicado</Chip>
          ) : null}
        </div>
        {draft.inflectionNote ? <p className="mt-2 text-secondary text-text-2">{draft.inflectionNote}</p> : null}
        {draft.audioUrl ? <p className="mt-1 text-caption text-text-3">Grabación británica disponible.</p> : null}
      </div>

      {hasSentence ? (
        <Block title="Traducción de tu frase">
          <textarea
            aria-label="Traducción de tu frase"
            rows={2}
            value={draft.contextTranslationEs}
            onChange={(event) => set({ contextTranslationEs: event.target.value })}
            spellCheck={false}
            className={`${INPUT} h-auto resize-none py-2 leading-snug`}
          />
        </Block>
      ) : null}

      <Block title="Acepciones">
        <ul className="space-y-2">
          {draft.senses.map((sense, index) => (
            <li key={sense.id} className="rounded-card border border-border bg-surface-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {editable ? (
                    <select
                      aria-label="Tipo de palabra"
                      value={sense.pos}
                      onChange={(event) => updateSense(index, { pos: event.target.value as PartOfSpeech })}
                      className="h-8 rounded-control border border-border bg-surface px-2 text-secondary"
                    >
                      {POS_OPTIONS.map((pos) => (
                        <option key={pos} value={pos}>
                          {POS_LABEL_ES[pos]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Chip tone={posTone(sense.pos)}>{POS_LABEL_ES[sense.pos]}</Chip>
                  )}
                  {sense.matchesContext ? <Chip tone="accent">En tu frase</Chip> : null}
                </div>
                {draft.senses.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`Quitar la acepción ${index + 1}`}
                    onClick={() => set({ senses: draft.senses.filter((_, i) => i !== index) })}
                    className="-m-2 flex size-11 items-center justify-center text-text-3"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              <input
                aria-label="Significado en español"
                value={sense.meaningEs}
                onChange={(event) => updateSense(index, { meaningEs: event.target.value })}
                placeholder="Significado en español"
                autoCapitalize="off"
                spellCheck={false}
                className={`${INPUT} mt-2`}
              />
              <input
                aria-label="Definición en inglés"
                value={sense.definitionEn}
                onChange={(event) => updateSense(index, { definitionEn: event.target.value })}
                placeholder="Definición en inglés"
                autoCapitalize="off"
                spellCheck={false}
                className={`${INPUT} mt-1.5 text-text-2`}
              />
              {sense.examples.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {sense.examples.map((example) => (
                    <li key={example.en} className="text-secondary">
                      <Highlight text={example.en} target={example.target} />
                      {example.es ? <span className="block text-text-3">{example.es}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </Block>

      {verb || noun || adjective ? (
        <Block title="Formas">
          <div className="space-y-1 text-secondary text-text-2">
            {verb ? (
              <p>
                {[verb.base, verb.thirdPerson, verb.pastSimple.join(' / '), verb.pastParticiple.join(' / '), verb.presentParticiple].join(' · ')}
                {verb.irregular ? <span className="ml-2 text-accent">irregular</span> : null}
              </p>
            ) : null}
            {noun ? (
              <p>
                {noun.plural ? `plural: ${noun.plural} · ` : ''}
                {noun.countability === 'countable' ? 'contable' : noun.countability === 'uncountable' ? 'incontable' : 'contable e incontable'}
              </p>
            ) : null}
            {adjective ? (
              <p>{[adjective.comparative, adjective.superlative].filter(Boolean).join(' · ')}</p>
            ) : null}
          </div>
        </Block>
      ) : null}

      {draft.family.length > 0 ? (
        <Block title="Familia de palabras">
          <div className="flex flex-wrap gap-1.5">
            {draft.family.map((member) => (
              <Chip key={member.word} tone={posTone(member.pos)}>
                {member.word}
              </Chip>
            ))}
          </div>
        </Block>
      ) : null}

      {draft.synonyms.length + draft.antonyms.length + draft.collocations.length > 0 ? (
        <Block title="Relacionadas">
          <dl className="space-y-1 text-secondary">
            {draft.synonyms.length > 0 ? (
              <div>
                <dt className="inline text-text-3">Sinónimos: </dt>
                <dd className="inline text-text-2">{draft.synonyms.join(', ')}</dd>
              </div>
            ) : null}
            {draft.antonyms.length > 0 ? (
              <div>
                <dt className="inline text-text-3">Antónimos: </dt>
                <dd className="inline text-text-2">{draft.antonyms.join(', ')}</dd>
              </div>
            ) : null}
            {draft.collocations.length > 0 ? (
              <div>
                <dt className="inline text-text-3">Colocaciones: </dt>
                <dd className="inline text-text-2">{draft.collocations.join(', ')}</dd>
              </div>
            ) : null}
          </dl>
        </Block>
      ) : null}

      {draft.learnerNote || draft.usNote ? (
        <Block title="Notas">
          <div className="space-y-1 text-secondary text-text-2">
            {draft.learnerNote ? <p>{draft.learnerNote}</p> : null}
            {draft.usNote ? <p>{draft.usNote}</p> : null}
          </div>
        </Block>
      ) : null}

      <Block title={`Temas (${topicCount}/${MAX_TOPICS})`}>
        <div className="flex flex-wrap items-center gap-1.5">
          {chosenTopics.map((topic) => (
            <button
              key={topic.id}
              type="button"
              aria-label={`Quitar el tema ${topic.nameEs}`}
              onClick={() => set({ topicIds: draft.topicIds.filter((id) => id !== topic.id) })}
              className="flex h-[26px] items-center gap-1 rounded-chip bg-surface-2 px-2 text-secondary"
            >
              <span aria-hidden="true">{topic.emoji}</span>
              {topic.nameEs}
              <X size={12} aria-hidden="true" />
            </button>
          ))}
          {draft.newTopic ? (
            <button
              type="button"
              aria-label={`Quitar el tema nuevo ${draft.newTopic.nameEs}`}
              onClick={() => set({ newTopic: null })}
              className="flex h-[26px] items-center gap-1 rounded-chip border border-dashed border-accent/50 px-2 text-secondary text-accent"
            >
              <span aria-hidden="true">{draft.newTopic.emoji}</span>
              {draft.newTopic.nameEs} (nuevo)
              <X size={12} aria-hidden="true" />
            </button>
          ) : null}
          {topicCount < MAX_TOPICS && availableTopics.length > 0 ? (
            <select
              aria-label="Añadir un tema"
              value=""
              onChange={(event) => event.target.value && set({ topicIds: [...draft.topicIds, event.target.value] })}
              className="h-[26px] rounded-chip border border-border bg-surface px-2 text-secondary text-text-2"
            >
              <option value="">+ tema</option>
              {availableTopics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.emoji} {topic.nameEs}
                </option>
              ))}
            </select>
          ) : null}
          {topicCount === 0 && availableTopics.length === 0 ? (
            <span className="text-secondary text-text-3">Sin tema</span>
          ) : null}
        </div>
      </Block>
    </div>
  )
}
