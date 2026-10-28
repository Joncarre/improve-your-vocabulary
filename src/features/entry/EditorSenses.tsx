import { Plus } from 'lucide-react'
import { POS_LABEL_ES, POS_OPTIONS } from '../../lib/pos.ts'
import { REGISTER_LABEL_ES } from '../../lib/register.ts'
import type { FamilyMember, PartOfSpeech, Register, Sense } from '../../shared/index.ts'
import { Button } from '../../ui/Button.tsx'
import { emptyEditorSense, emptyVerbForms, type EditorDraft } from './editorModel.ts'
import { AreaField, EditorCard, EditorGroup, SelectInput, TextField } from './editorFields.tsx'

const POS_CHOICES = POS_OPTIONS.map((value) => ({ value, label: POS_LABEL_ES[value] }))
const REGISTER_CHOICES = (Object.keys(REGISTER_LABEL_ES) as Register[]).map((value) => ({
  value,
  label: REGISTER_LABEL_ES[value],
}))
const COUNTABILITY_CHOICES = [
  { value: 'countable', label: 'Contable' },
  { value: 'uncountable', label: 'Incontable' },
  { value: 'both', label: 'Contable e incontable' },
] as const

type Patch = (patch: Partial<EditorDraft>) => void

function AddButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <Button onClick={onClick} className="w-full">
      <Plus size={16} aria-hidden="true" />
      {children}
    </Button>
  )
}

/* Acepciones */

export function SensesEditor({ draft, patch }: { draft: EditorDraft; patch: Patch }) {
  const update = (index: number, change: Partial<Sense>) =>
    patch({ senses: draft.senses.map((sense, i) => (i === index ? { ...sense, ...change } : sense)) })

  return (
    <EditorGroup title="Acepciones">
      {draft.senses.map((sense, index) => (
        <EditorCard
          key={sense.id}
          title={`Acepción ${index + 1}`}
          onRemove={() => patch({ senses: draft.senses.filter((_, i) => i !== index) })}
        >
          <div className="grid grid-cols-2 gap-2">
            <SelectInput<PartOfSpeech>
              label="Tipo"
              value={sense.pos}
              options={POS_CHOICES}
              onChange={(pos) => update(index, { pos })}
            />
            <SelectInput<Register>
              label="Registro"
              value={sense.register}
              options={REGISTER_CHOICES}
              onChange={(register) => update(index, { register })}
            />
          </div>
          <TextField label="Significado en español" lang="es" value={sense.meaningEs} onChange={(meaningEs) => update(index, { meaningEs })} />
          <AreaField label="Definición en inglés" lang="en" value={sense.definitionEn} onChange={(definitionEn) => update(index, { definitionEn })} />

          {sense.examples.map((example, exampleIndex) => (
            <EditorCard
              key={exampleIndex}
              title={`Ejemplo ${exampleIndex + 1}`}
              onRemove={() => update(index, { examples: sense.examples.filter((_, i) => i !== exampleIndex) })}
            >
              <AreaField
                label="Frase en inglés"
                lang="en"
                value={example.en}
                onChange={(en) =>
                  update(index, { examples: sense.examples.map((item, i) => (i === exampleIndex ? { ...item, en } : item)) })
                }
              />
              <TextField
                label="Traducción"
                lang="es"
                value={example.es}
                onChange={(es) =>
                  update(index, { examples: sense.examples.map((item, i) => (i === exampleIndex ? { ...item, es } : item)) })
                }
              />
              <TextField
                label="Forma exacta de la palabra en la frase"
                lang="en"
                value={example.target ?? ''}
                onChange={(target) =>
                  update(index, { examples: sense.examples.map((item, i) => (i === exampleIndex ? { ...item, target } : item)) })
                }
              />
            </EditorCard>
          ))}
          <AddButton onClick={() => update(index, { examples: [...sense.examples, { en: '', es: '' }] })}>
            Añadir ejemplo
          </AddButton>
        </EditorCard>
      ))}
      <AddButton onClick={() => patch({ senses: [...draft.senses, emptyEditorSense()] })}>Añadir acepción</AddButton>
    </EditorGroup>
  )
}

/* Formas */

export function FormsEditor({ draft, patch }: { draft: EditorDraft; patch: Patch }) {
  const { verb, noun, adjective } = draft
  return (
    <EditorGroup title="Formas">
      {verb ? (
        <EditorCard title="Verbo" onRemove={() => patch({ verb: null })}>
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Base" lang="en" value={verb.base} onChange={(base) => patch({ verb: { ...verb, base } })} />
            <TextField label="3.ª persona" lang="en" value={verb.thirdPerson} onChange={(thirdPerson) => patch({ verb: { ...verb, thirdPerson } })} />
            <TextField label="Past simple" lang="en" value={verb.pastSimple} onChange={(pastSimple) => patch({ verb: { ...verb, pastSimple } })} />
            <TextField label="Past participle" lang="en" value={verb.pastParticiple} onChange={(pastParticiple) => patch({ verb: { ...verb, pastParticiple } })} />
            <TextField label="-ing" lang="en" value={verb.presentParticiple} onChange={(presentParticiple) => patch({ verb: { ...verb, presentParticiple } })} />
          </div>
          <p className="text-caption text-text-3">Si hay dos formas, sepáralas con comas: learnt, learned.</p>
          <label className="flex min-h-11 items-center gap-2 text-body">
            <input
              type="checkbox"
              checked={verb.irregular}
              onChange={(event) => patch({ verb: { ...verb, irregular: event.target.checked } })}
              className="size-5 accent-accent"
            />
            Verbo irregular
          </label>
        </EditorCard>
      ) : (
        <AddButton onClick={() => patch({ verb: emptyVerbForms() })}>Añadir formas de verbo</AddButton>
      )}

      {noun ? (
        <EditorCard title="Sustantivo" onRemove={() => patch({ noun: null })}>
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Plural" lang="en" value={noun.plural} onChange={(plural) => patch({ noun: { ...noun, plural } })} />
            <SelectInput
              label="Cantidad"
              value={noun.countability}
              options={COUNTABILITY_CHOICES}
              onChange={(countability) => patch({ noun: { ...noun, countability } })}
            />
          </div>
        </EditorCard>
      ) : (
        <AddButton onClick={() => patch({ noun: { plural: '', countability: 'countable' } })}>Añadir formas de sustantivo</AddButton>
      )}

      {adjective ? (
        <EditorCard title="Adjetivo" onRemove={() => patch({ adjective: null })}>
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Comparativo" lang="en" value={adjective.comparative} onChange={(comparative) => patch({ adjective: { ...adjective, comparative } })} />
            <TextField label="Superlativo" lang="en" value={adjective.superlative} onChange={(superlative) => patch({ adjective: { ...adjective, superlative } })} />
          </div>
        </EditorCard>
      ) : (
        <AddButton onClick={() => patch({ adjective: { comparative: '', superlative: '' } })}>Añadir formas de adjetivo</AddButton>
      )}
    </EditorGroup>
  )
}

/* Familia de palabras */

export function FamilyEditor({ draft, patch }: { draft: EditorDraft; patch: Patch }) {
  const update = (index: number, change: Partial<FamilyMember>) =>
    patch({ family: draft.family.map((member, i) => (i === index ? { ...member, ...change } : member)) })

  return (
    <EditorGroup title="Familia de palabras">
      {draft.family.map((member, index) => (
        <EditorCard
          key={index}
          title={member.word || `Palabra ${index + 1}`}
          onRemove={() => patch({ family: draft.family.filter((_, i) => i !== index) })}
        >
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Palabra" lang="en" value={member.word} onChange={(word) => update(index, { word })} />
            <SelectInput<PartOfSpeech> label="Tipo" value={member.pos} options={POS_CHOICES} onChange={(pos) => update(index, { pos })} />
          </div>
          <TextField label="Significado" lang="es" value={member.meaningEs} onChange={(meaningEs) => update(index, { meaningEs })} />
          <TextField label="Ejemplo" lang="en" value={member.example} onChange={(example) => update(index, { example })} />
        </EditorCard>
      ))}
      <AddButton onClick={() => patch({ family: [...draft.family, { word: '', pos: 'noun', meaningEs: '', example: '' }] })}>
        Añadir palabra de la familia
      </AddButton>
    </EditorGroup>
  )
}
