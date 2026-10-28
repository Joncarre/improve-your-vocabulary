import type { RefObject } from 'react'
import { POS_LABEL_ES, posTone } from '../../lib/pos.ts'
import type { ProductionModel } from '../../srs/cardModel.ts'
import type { CheckResult, DiffPart } from '../../srs/checker.ts'
import { Chip } from '../../ui/Chip.tsx'
import { SpeakerButton } from '../../ui/SpeakerButton.tsx'

interface FrontProps {
  model: ProductionModel
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  inputRef: RefObject<HTMLInputElement | null>
}

/** Spanish to English, front: the meaning, the word type and a sentence with a gap; typing the answer is optional. */
export function ProductionFront({ model, value, onChange, onSubmit, inputRef }: FrontProps) {
  const { sense, cloze } = model
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      <div>
        {sense ? (
          <div className="mb-1.5">
            <Chip tone={posTone(sense.pos)}>{POS_LABEL_ES[sense.pos]}</Chip>
          </div>
        ) : null}
        <p className="text-[26px] font-semibold leading-tight [overflow-wrap:anywhere]">{sense?.meaningEs}</p>
      </div>

      {cloze ? (
        <p className="text-[19px] leading-relaxed [overflow-wrap:anywhere]">
          {cloze.before}
          <span
            aria-label="hueco"
            style={{ width: `${Math.min(14, Math.max(4, cloze.answer.length))}ch` }}
            className="mx-0.5 inline-block border-b-2 border-accent align-baseline"
          >
            &nbsp;
          </span>
          {cloze.after}
        </p>
      ) : (
        <p className="text-body text-text-2">Escribe la palabra o expresión en inglés.</p>
      )}

      <form
        className="mt-auto"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <label className="block">
          <span className="mb-1 block text-caption text-text-3">Tu respuesta (opcional)</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            lang="en"
            enterKeyHint="done"
            className="h-12 w-full min-w-0 rounded-control border border-border bg-surface-2 px-3 text-[17px] text-text placeholder:text-text-3"
          />
        </label>
      </form>
    </div>
  )
}

function Diff({ parts, tone }: { parts: DiffPart[]; tone: string }) {
  return (
    <>
      {parts.map((part, index) => (
        <span key={index} className={part.changed ? `rounded-sm px-px underline decoration-2 underline-offset-4 ${tone}` : undefined}>
          {part.text}
        </span>
      ))}
    </>
  )
}

/** What the comparison said: right, almost (with the letters that differ) or the answer. */
function Verdict({ result, typed }: { result: CheckResult; typed: string }) {
  if (result.verdict === 'empty') return null
  if (result.verdict === 'exact') {
    return <p className="rounded-card border border-good/40 bg-good/10 px-3 py-2 text-body font-medium text-good">¡Correcto!</p>
  }
  if (result.verdict === 'typo' && result.diff) {
    return (
      <div className="rounded-card border border-hard/40 bg-hard/10 px-3 py-2 text-hard">
        <p className="text-body font-medium">Casi: una letra de más, de menos o cambiada</p>
        <p className="mt-0.5 text-secondary text-text">
          Tú: <Diff parts={result.diff.typed} tone="text-again" /> <span aria-hidden="true">→</span> <span className="sr-only">correcto: </span>
          <Diff parts={result.diff.expected} tone="text-good" />
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-card border border-again/40 bg-again/10 px-3 py-2 text-again">
      <p className="text-body font-medium">Era «{result.expected}»</p>
      <p className="text-secondary text-text-2">Tú: {typed}</p>
    </div>
  )
}

interface BackProps {
  model: ProductionModel
  result: CheckResult | null
  typed: string
}

/** Back: how the answer compared, the full sentence with the word in place, and its translation. */
export function ProductionBack({ model, result, typed }: BackProps) {
  const { entry, sense, example, cloze } = model
  const sentence = cloze ? `${cloze.before}${cloze.answer}${cloze.after}` : (example?.sentence ?? '')
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-5">
      {result ? <Verdict result={result} typed={typed} /> : null}

      <div className="flex items-center gap-1">
        <span className="font-serif text-word-card font-medium [overflow-wrap:anywhere]">{cloze?.answer ?? entry.lemma}</span>
        <SpeakerButton id="review-answer" text={cloze?.answer ?? entry.lemma} audioUrl={cloze ? undefined : entry.audioUrl} label="Escuchar la respuesta" />
      </div>
      {entry.ipa ? <p className="ipa -mt-2 text-ipa text-text-2">{entry.ipa}</p> : null}

      {sentence ? (
        <section className="rounded-card border border-border bg-surface-2 p-3">
          <div className="flex items-start gap-1">
            <p className="min-w-0 flex-1 text-body [overflow-wrap:anywhere]">
              {cloze ? (
                <>
                  {cloze.before}
                  <mark className="bg-transparent font-semibold text-accent">{cloze.answer}</mark>
                  {cloze.after}
                </>
              ) : (
                sentence
              )}
            </p>
            <SpeakerButton id="review-sentence" text={sentence} label="Escuchar la frase" className="-mr-2 -mt-2.5 shrink-0" />
          </div>
          {example?.translationEs ? <p className="mt-0.5 text-secondary text-text-2">{example.translationEs}</p> : null}
        </section>
      ) : null}

      {sense ? (
        <p className="text-secondary text-text-3">
          <span className="text-text-2">{sense.meaningEs}</span>
          {sense.definitionEn ? ` · ${sense.definitionEn}` : ''}
        </p>
      ) : null}
    </div>
  )
}
