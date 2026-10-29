import { useEffect } from 'react'
import { stopAudio } from '../../audio/useSpeech.ts'
import { BackLink } from '../../ui/BackLink.tsx'
import { IpaBreakdown } from './IpaBreakdown.tsx'
import {
  GROUP_INFO,
  MARKS,
  PITFALLS,
  soundsInGroup,
  type Mark,
  type Sound,
  type SoundGroup,
  type SoundExample,
} from './sounds.ts'
import { WordButton } from './WordButton.tsx'

const JUMPS = [
  { id: 'vocales', label: 'Vocales' },
  { id: 'diptongos', label: 'Diptongos' },
  { id: 'consonantes', label: 'Consonantes' },
  { id: 'acento', label: 'Acento y duración' },
  { id: 'errores', label: 'Errores típicos' },
] as const

function Words({ idBase, examples }: { idBase: string; examples: readonly SoundExample[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {examples.map((example) => (
        <WordButton key={example.word} id={`${idBase}-${example.word}`} word={example.word} ipa={example.ipa} />
      ))}
    </div>
  )
}

/**
 * One row of the table: the symbol, what it sounds like in Spanish, how to make it and words to
 * hear. On a phone the symbol sits beside the title so the text can use the whole width; from "sm"
 * up it is a column of its own.
 */
function SymbolRow({ item }: { item: Sound | Mark }) {
  const title = 'name' in item ? item.name : item.hint
  return (
    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-3 px-3 py-3 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:items-start">
      <div className="ipa text-center text-[26px] leading-none text-accent sm:row-span-3 sm:pt-0.5 sm:text-[28px]">{item.symbol}</div>
      <h3 className="text-body font-semibold">{title}</h3>
      <p className="col-span-2 mt-1 text-secondary text-text-2 sm:col-span-1 sm:col-start-2 sm:mt-0.5">{item.tip}</p>
      <div className="col-span-2 sm:col-span-1 sm:col-start-2">
        <Words idBase={`sym-${item.symbol}`} examples={item.examples} />
      </div>
    </li>
  )
}

function Table({ title, intro, id, children }: { title: string; intro: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-6 scroll-mt-4">
      <h2 className="text-section font-semibold">{title}</h2>
      <p className="mt-0.5 mb-2 text-secondary text-text-2">{intro}</p>
      <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">{children}</ul>
    </section>
  )
}

function GroupTable({ group, id }: { group: SoundGroup; id?: string }) {
  const info = GROUP_INFO[group]
  return (
    <Table title={info.title} intro={info.intro} {...(id ? { id } : {})}>
      {soundsInGroup(group).map((sound) => (
        <SymbolRow key={sound.symbol} item={sound} />
      ))}
    </Table>
  )
}

/** Guide to the British (RP) sounds for a Spanish speaker: how to read the IPA the app shows. */
export default function PhoneticsPage() {
  useEffect(() => () => stopAudio(), [])

  return (
    <>
      <BackLink to="/vocabulary" label="Vocabulario" className="lg:hidden" />
      <h1 className="mt-2 text-title font-semibold tracking-tight">Pronunciación</h1>
      <p className="mt-1 text-secondary text-text-2">Cómo leer la IPA, explicado para quien habla español.</p>

      <nav aria-label="Secciones de la guía" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {JUMPS.map((jump) => (
          <a
            key={jump.id}
            href={`#${jump.id}`}
            className="inline-flex h-9 shrink-0 items-center rounded-chip border border-border bg-surface px-3 text-secondary text-text-2 active:bg-surface-2"
          >
            {jump.label}
          </a>
        ))}
      </nav>

      <section className="mt-5">
        <h2 className="text-section font-semibold">Cómo funciona</h2>
        <ul className="mt-2 space-y-2 rounded-card border border-border bg-surface p-3 text-secondary text-text-2">
          <li>
            <span className="font-medium text-text">La IPA escribe cómo suena una palabra, no cómo se escribe.</span> Va entre barras:{' '}
            <span className="ipa">/ɡəʊ/</span>. En inglés la ortografía engaña (<i>through</i>, <i>though</i>, <i>tough</i>); la IPA no.
          </li>
          <li>
            <span className="font-medium text-text">Un símbolo = un sonido, siempre el mismo.</span> Muchos son como en español
            (<span className="ipa">p t k m n l s f</span>): empieza por los que no lo son.
          </li>
          <li>
            <span className="font-medium text-text">Toca cualquier palabra para oírla</span> con voz británica (la que elijas en Ajustes).
            Repite en voz alta y compara.
          </li>
          <li>
            Lo que está <span className="font-medium text-text">después de «ˈ»</span> es la sílaba fuerte; «ː» alarga la vocal.
          </li>
        </ul>

        <div className="mt-3 rounded-card border border-border bg-surface p-3">
          <p className="text-caption text-text-3">Un ejemplo, paso a paso</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3">
            <span className="font-serif text-word-entry font-medium">knackered</span>
            <span className="ipa text-ipa text-text-2">/ˈnækəd/</span>
            <WordButton id="intro-knackered" word="knackered" />
          </div>
          <IpaBreakdown ipa="/ˈnækəd/" defaultOpen idPrefix="intro" />
        </div>
      </section>

      <div id="vocales" className="scroll-mt-4">
        <GroupTable group="shortVowel" />
        <GroupTable group="longVowel" />
      </div>
      <GroupTable group="diphthong" id="diptongos" />
      <div id="consonantes" className="scroll-mt-4">
        <GroupTable group="familiar" />
        <GroupTable group="careful" />
      </div>

      <Table
        id="acento"
        title="Acento y duración"
        intro="No son sonidos, sino marcas que dicen cómo decir los que tienen al lado."
      >
        {MARKS.map((mark) => (
          <SymbolRow key={mark.symbol} item={mark} />
        ))}
      </Table>

      <section id="errores" className="mt-6 scroll-mt-4">
        <h2 className="text-section font-semibold">Errores típicos de un hispanohablante</h2>
        <p className="mt-0.5 mb-2 text-secondary text-text-2">Lo que más suele costar, con palabras para practicar.</p>
        <ol className="space-y-2">
          {PITFALLS.map((pitfall, index) => (
            <li key={pitfall.title} className="rounded-card border border-border bg-surface p-3">
              <h3 className="text-body font-semibold">
                <span className="mr-1.5 text-text-3">{index + 1}.</span>
                {pitfall.title}
              </h3>
              <p className="mt-0.5 text-secondary text-text-2">{pitfall.text}</p>
              <Words idBase={`pit-${index}`} examples={pitfall.words} />
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
