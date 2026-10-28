import { TriangleAlert } from 'lucide-react'
import { POS_LABEL_ES, posTone } from '../../lib/pos.ts'
import { REGISTER_LABEL_ES } from '../../lib/register.ts'
import type { Entry } from '../../shared/index.ts'
import { Chip } from '../../ui/Chip.tsx'
import { SpeakerButton } from '../../ui/SpeakerButton.tsx'
import { IpaBreakdown } from '../phonetics/IpaBreakdown.tsx'

/** The registers that deserve a visible warning (spec §6). */
function delicateRegister(entry: Entry): 'slang' | 'offensive' | undefined {
  const registers = entry.senses.map((sense) => sense.register)
  if (registers.includes('offensive')) return 'offensive'
  if (registers.includes('slang')) return 'slang'
  return undefined
}

/** Word, RP pronunciation with audio, word types, level and register. */
export function EntryHeader({ entry }: { entry: Entry }) {
  const types = [...new Set(entry.senses.map((sense) => sense.pos))]
  const delicate = delicateRegister(entry)
  const otherRegisters = [...new Set(entry.senses.map((sense) => sense.register))].filter(
    (register) => register !== 'neutral' && register !== 'slang' && register !== 'offensive',
  )

  return (
    <header className="mt-2">
      <h1 className="font-serif text-word-entry font-medium [overflow-wrap:anywhere]">{entry.lemma}</h1>
      <div className="-mt-1 flex items-center">
        {entry.ipa ? <span className="ipa mr-1 text-ipa text-text-2">{entry.ipa}</span> : null}
        <SpeakerButton id="word" text={entry.lemma} audioUrl={entry.audioUrl} label={`Escuchar «${entry.lemma}»`} />
        <SpeakerButton id="word-slow" text={entry.lemma} audioUrl={entry.audioUrl} slow label={`Escuchar «${entry.lemma}» despacio`} />
      </div>
      {entry.ipa ? <IpaBreakdown ipa={entry.ipa} idPrefix="entry-ipa" /> : null}

      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {types.map((pos) => (
          <Chip key={pos} tone={posTone(pos)}>
            {POS_LABEL_ES[pos]}
          </Chip>
        ))}
        {entry.cefr ? <Chip tone="accent">{entry.cefr}</Chip> : null}
        {otherRegisters.map((register) => (
          <Chip key={register}>{REGISTER_LABEL_ES[register]}</Chip>
        ))}
        {entry.isLeech ? <Chip tone="again">Rebelde</Chip> : null}
        {entry.status === 'pending_ai' ? <Chip tone="hard">Pendiente de completar</Chip> : null}
        {entry.status === 'archived' ? <Chip>Archivada</Chip> : null}
      </div>

      {delicate ? (
        <p
          role="note"
          className={`mt-3 flex items-start gap-2 rounded-card border p-3 text-secondary ${
            delicate === 'offensive' ? 'border-again/40 bg-again/10 text-again' : 'border-hard/40 bg-hard/10 text-hard'
          }`}
        >
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {delicate === 'offensive'
            ? 'Palabra ofensiva: puede resultar muy grosera o insultante.'
            : 'Argot (slang): muy informal, no la uses en un contexto formal.'}
        </p>
      ) : null}

      {entry.seenForm ? (
        <p className="mt-3 text-secondary text-text-2">
          Apuntada como «{entry.seenForm}».
        </p>
      ) : null}
    </header>
  )
}
