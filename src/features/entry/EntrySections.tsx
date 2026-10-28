import { Check, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { findHighlightTarget } from '../../lib/highlight.ts'
import { POS_LABEL_ES, posTone } from '../../lib/pos.ts'
import { REGISTER_LABEL_ES } from '../../lib/register.ts'
import type { Entry, PartOfSpeech, Sense, Source } from '../../shared/index.ts'
import { Chip } from '../../ui/Chip.tsx'
import { Highlight } from '../../ui/Highlight.tsx'
import { SpeakerButton } from '../../ui/SpeakerButton.tsx'
import { playAudio } from '../../audio/useSpeech.ts'
import type { RelatedEntry, RelatedReason } from './related.ts'
import { Section, Translation } from './Section.tsx'

/* 2 · Dónde la viste */

export function ContextsSection({ entry, sources }: { entry: Entry; sources: Source[] }) {
  if (entry.contexts.length === 0) return null
  const sourceOf = (id: string | undefined) => sources.find((source) => source.id === id)

  return (
    <Section title="Dónde la viste">
      <ul className="space-y-2">
        {entry.contexts.map((context) => {
          const source = sourceOf(context.sourceId)
          return (
            <li key={context.id} className="rounded-card border border-border bg-surface p-3">
              <div className="flex items-start gap-1">
                <p className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  <Highlight text={context.sentence} target={findHighlightTarget(context.sentence, entry, context.surface)} />
                </p>
                <SpeakerButton
                  id={`ctx-${context.id}`}
                  text={context.sentence}
                  label="Escuchar la frase"
                  className="-mr-2 -mt-2.5 shrink-0"
                />
              </div>
              <Translation text={context.translationEs ?? ''} />
              {source || context.detail ? (
                <p className="mt-1 text-caption text-text-3">
                  {source ? (
                    <Link to={`/source/${source.id}`} className="inline-flex min-h-6 items-center text-accent">
                      {source.title}
                    </Link>
                  ) : null}
                  {source && context.detail ? ' · ' : ''}
                  {context.detail}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

/* 3 · Acepciones agrupadas por tipo de palabra */

function SenseCard({ entry, sense, index }: { entry: Entry; sense: Sense; index: number }) {
  return (
    <li
      className={`rounded-card border p-3 ${sense.matchesContext ? 'border-accent/50 bg-accent/5' : 'border-border bg-surface'}`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-body font-semibold">{sense.meaningEs}</p>
        {sense.matchesContext ? <Chip tone="accent">En tu frase</Chip> : null}
        {sense.register !== 'neutral' ? <Chip>{REGISTER_LABEL_ES[sense.register]}</Chip> : null}
      </div>
      {sense.definitionEn ? <p className="mt-0.5 text-secondary text-text-2">{sense.definitionEn}</p> : null}
      {sense.examples.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {sense.examples.map((example, exampleIndex) => (
            <li key={example.en} className="border-l-2 border-border pl-3">
              <div className="flex items-start gap-1">
                <p className="min-w-0 flex-1 text-secondary [overflow-wrap:anywhere]">
                  <Highlight
                    text={example.en}
                    target={findHighlightTarget(example.en, entry, example.target)}
                  />
                </p>
                <SpeakerButton
                  id={`ex-${index}-${exampleIndex}`}
                  text={example.en}
                  label="Escuchar el ejemplo"
                  className="-mr-2 -mt-2.5 shrink-0"
                />
              </div>
              <Translation text={example.es} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function SensesSection({ entry }: { entry: Entry }) {
  if (entry.senses.length === 0) return null
  // Group by word type (run: verbo / sustantivo), keeping the order in which each type first appears.
  const groups = new Map<PartOfSpeech, Array<{ sense: Sense; index: number }>>()
  entry.senses.forEach((sense, index) => groups.set(sense.pos, [...(groups.get(sense.pos) ?? []), { sense, index }]))

  return (
    <Section title="Acepciones">
      <div className="space-y-4">
        {[...groups].map(([pos, items]) => (
          <div key={pos}>
            <div className="mb-1.5">
              <Chip tone={posTone(pos)}>{POS_LABEL_ES[pos]}</Chip>
            </div>
            <ul className="space-y-2">
              {items.map(({ sense, index }) => (
                <SenseCard key={sense.id} entry={entry} sense={sense} index={index} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  )
}

/* 4 · Formas */

function FormWord({ id, word }: { id: string; word: string }) {
  return (
    <button
      type="button"
      aria-label={`Escuchar «${word}»`}
      onClick={() => playAudio({ key: id, text: word })}
      className="-mx-1 inline-flex min-h-11 min-w-11 items-center px-1 text-left text-body active:text-accent"
    >
      {word}
    </button>
  )
}

function FormCell({ label, id, words }: { label: string; id: string; words: string[] }) {
  if (words.length === 0) return null
  return (
    <div className="rounded-card border border-border bg-surface px-3 py-1.5">
      <div className="text-caption text-text-3">{label}</div>
      <div className="flex flex-wrap gap-x-3">
        {words.map((word, index) => (
          <FormWord key={word} id={`${id}-${index}`} word={word} />
        ))}
      </div>
    </div>
  )
}

const COUNTABILITY_ES = { countable: 'Contable', uncountable: 'Incontable', both: 'Contable e incontable' } as const

export function FormsSection({ entry }: { entry: Entry }) {
  const verb = entry.forms?.verb
  const noun = entry.forms?.noun
  const adjective = entry.forms?.adjective
  if (!verb && !noun && !adjective) return null

  return (
    <Section title="Formas">
      {verb ? (
        <div>
          {verb.irregular ? (
            <div className="mb-1.5">
              <Chip tone="adverb">verbo irregular</Chip>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <FormCell label="Base" id="f-base" words={[verb.base]} />
            <FormCell label="3.ª persona" id="f-third" words={[verb.thirdPerson]} />
            <FormCell label="Past simple" id="f-past" words={verb.pastSimple} />
            <FormCell label="Past participle" id="f-pp" words={verb.pastParticiple} />
            <FormCell label="-ing" id="f-ing" words={[verb.presentParticiple]} />
          </div>
        </div>
      ) : null}
      {noun ? (
        <div className={`grid grid-cols-2 gap-2 ${verb ? 'mt-3' : ''}`}>
          <FormCell label="Plural" id="f-plural" words={noun.plural ? [noun.plural] : []} />
          <div className="rounded-card border border-border bg-surface px-3 py-1.5">
            <div className="text-caption text-text-3">Sustantivo</div>
            <div className="min-h-11 content-center text-body">{COUNTABILITY_ES[noun.countability]}</div>
          </div>
        </div>
      ) : null}
      {adjective ? (
        <div className={`grid grid-cols-2 gap-2 ${verb || noun ? 'mt-3' : ''}`}>
          <FormCell label="Comparativo" id="f-comp" words={adjective.comparative ? [adjective.comparative] : []} />
          <FormCell label="Superlativo" id="f-sup" words={adjective.superlative ? [adjective.superlative] : []} />
        </div>
      ) : null}
    </Section>
  )
}

/* 5 · Familia de palabras */

interface FamilySectionProps {
  entry: Entry
  /** The active entries of the collection by lemmaKey, to know which family members are already there. */
  byKey: Map<string, Entry>
  onAdd: (word: string) => void
  keyOf: (word: string) => string
}

export function FamilySection({ entry, byKey, onAdd, keyOf }: FamilySectionProps) {
  if (entry.family.length === 0) return null
  return (
    <Section title="Familia de palabras">
      <ul className="flex flex-wrap gap-x-1 gap-y-0">
        {entry.family.map((member) => {
          const existing = byKey.get(keyOf(member.word))
          const content = (
            <>
              <Chip tone={posTone(member.pos)}>
                {member.word}
                {existing ? (
                  <Check size={11} className="ml-1" aria-hidden="true" />
                ) : (
                  <Plus size={11} className="ml-1" aria-hidden="true" />
                )}
              </Chip>
            </>
          )
          return (
            <li key={member.word}>
              {existing ? (
                <Link
                  to={`/entry/${existing.id}`}
                  aria-label={`Abrir la ficha de ${member.word}`}
                  className="inline-flex min-h-11 items-center"
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  aria-label={`Añadir ${member.word} a tu vocabulario`}
                  onClick={() => onAdd(member.word)}
                  className="inline-flex min-h-11 items-center"
                >
                  {content}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <ul className="mt-1 space-y-0.5 text-caption text-text-3">
        {entry.family.map((member) => (
          <li key={member.word}>
            <span className="text-text-2">{member.word}</span> · {member.meaningEs}
          </li>
        ))}
      </ul>
    </Section>
  )
}

/* 6 · Sinónimos, antónimos y colocaciones */

export function WordListsSection({ entry }: { entry: Entry }) {
  const lists = [
    { title: 'Sinónimos', items: entry.synonyms },
    { title: 'Antónimos', items: entry.antonyms },
    { title: 'Colocaciones', items: entry.collocations },
  ].filter((list) => list.items.length > 0)
  if (lists.length === 0) return null

  return (
    <Section title="Sinónimos, antónimos y colocaciones">
      <dl className="space-y-2">
        {lists.map((list) => (
          <div key={list.title} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <dt className="w-24 shrink-0 text-secondary text-text-3">{list.title}</dt>
            <dd className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {list.items.map((item) => (
                <span key={item} className="rounded-chip bg-surface-2 px-2 py-0.5 text-secondary">
                  {item}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

/* 7 · Nota para hispanohablantes */

export function NotesSection({ entry }: { entry: Entry }) {
  if (!entry.learnerNote && !entry.usNote) return null
  return (
    <Section title="Nota para hispanohablantes">
      <div className="space-y-2">
        {entry.learnerNote ? (
          <p className="rounded-card border border-border bg-surface p-3 text-secondary">{entry.learnerNote}</p>
        ) : null}
        {entry.usNote ? (
          <p className="rounded-card border border-border bg-surface p-3 text-secondary">
            <span className="font-medium text-text">Británico y americano. </span>
            {entry.usNote}
          </p>
        ) : null}
      </div>
    </Section>
  )
}

/* 8 · Relacionadas en tu colección */

const REASON_LABEL_ES: Record<RelatedReason, string> = {
  family: 'misma familia',
  topic: 'mismo tema',
  source: 'misma serie',
}

export function RelatedSection({ related }: { related: RelatedEntry[] }) {
  if (related.length === 0) return null
  return (
    <Section title="Relacionadas en tu colección">
      <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
        {related.map(({ entry, reason }) => (
          <li key={entry.id}>
            <Link to={`/entry/${entry.id}`} className="flex min-h-12 items-center justify-between gap-3 px-3 py-2 active:bg-surface-2">
              <span className="min-w-0">
                <span className="block truncate font-serif text-section font-medium">{entry.lemma}</span>
                <span className="block truncate text-secondary text-text-2">{entry.senses[0]?.meaningEs}</span>
              </span>
              <span className="shrink-0 text-caption text-text-3">{REASON_LABEL_ES[reason]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}
