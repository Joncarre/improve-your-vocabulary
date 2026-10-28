import { findHighlightTarget } from '../../lib/highlight.ts'
import { POS_LABEL_ES, posTone } from '../../lib/pos.ts'
import { REGISTER_LABEL_ES } from '../../lib/register.ts'
import type { RecognitionModel } from '../../srs/cardModel.ts'
import { Chip } from '../../ui/Chip.tsx'
import { Highlight } from '../../ui/Highlight.tsx'
import { SpeakerButton } from '../../ui/SpeakerButton.tsx'
import { familyLine, formsLine, otherMeanings } from './lines.ts'

/** English to Spanish, front: the word, how it sounds and, if enabled, a sentence where it is used. */
export function RecognitionFront({ model }: { model: RecognitionModel }) {
  const { entry, example, showSentence } = model
  const target = example ? findHighlightTarget(example.sentence, entry, example.target) : undefined
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 overflow-y-auto p-5 text-center">
      <h2 className="font-serif text-word-card font-medium [overflow-wrap:anywhere]">{entry.lemma}</h2>
      <div className="flex items-center gap-1">
        {entry.ipa ? <span className="ipa text-ipa text-text-2">{entry.ipa}</span> : null}
        <SpeakerButton id="review-word" text={entry.lemma} audioUrl={entry.audioUrl} label={`Escuchar «${entry.lemma}»`} />
      </div>
      {showSentence && example ? (
        <p className="mt-3 max-w-sm rounded-card border border-border bg-surface-2 px-4 py-3 text-left text-[17px] leading-snug [overflow-wrap:anywhere]">
          <Highlight text={example.sentence} target={target} />
        </p>
      ) : null}
      <p className="mt-4 text-caption text-text-3">Toca la tarjeta para ver el significado</p>
    </div>
  )
}

/** Back: the meaning of the sense the sentence used, the sentence, the forms and the family. */
export function RecognitionBack({ model }: { model: RecognitionModel }) {
  const { entry, sense, example } = model
  const target = example ? findHighlightTarget(example.sentence, entry, example.target) : undefined
  const forms = formsLine(entry)
  const family = familyLine(entry)
  const others = otherMeanings(entry, sense)

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-5">
      <div className="flex items-center gap-1">
        <span className="font-serif text-section font-medium">{entry.lemma}</span>
        {entry.ipa ? <span className="ipa text-caption text-text-2">{entry.ipa}</span> : null}
        <SpeakerButton id="review-word-back" text={entry.lemma} audioUrl={entry.audioUrl} label={`Escuchar «${entry.lemma}»`} className="-my-1" />
      </div>

      {sense ? (
        <section>
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            <Chip tone={posTone(sense.pos)}>{POS_LABEL_ES[sense.pos]}</Chip>
            {sense.register !== 'neutral' ? <Chip>{REGISTER_LABEL_ES[sense.register]}</Chip> : null}
          </div>
          <p className="text-[26px] font-semibold leading-tight [overflow-wrap:anywhere]">{sense.meaningEs}</p>
          {sense.definitionEn ? <p className="mt-1 text-secondary text-text-2">{sense.definitionEn}</p> : null}
        </section>
      ) : null}

      {example ? (
        <section className="rounded-card border border-border bg-surface-2 p-3">
          <div className="flex items-start gap-1">
            <p className="min-w-0 flex-1 text-body [overflow-wrap:anywhere]">
              <Highlight text={example.sentence} target={target} />
            </p>
            <SpeakerButton id="review-sentence" text={example.sentence} label="Escuchar la frase" className="-mr-2 -mt-2.5 shrink-0" />
          </div>
          {example.translationEs ? <p className="mt-0.5 text-secondary text-text-2">{example.translationEs}</p> : null}
        </section>
      ) : null}

      {others.length > 0 ? (
        <p className="text-secondary text-text-3">
          <span className="text-text-2">También significa:</span> {others.join(' · ')}
        </p>
      ) : null}
      {forms ? (
        <p className="text-secondary text-text-3">
          <span className="text-text-2">Formas:</span> {forms}
        </p>
      ) : null}
      {family ? (
        <p className="text-secondary text-text-3">
          <span className="text-text-2">Familia:</span> {family}
        </p>
      ) : null}
    </div>
  )
}
