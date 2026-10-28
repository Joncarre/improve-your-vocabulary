import { newId } from '../../lib/id.ts'
import type { Cefr, Context, Entry, EntryKind, FamilyMember, Forms, Sense } from '../../shared/index.ts'

/** Comma-separated text to a clean list ("a, b ,, c" -> ["a", "b", "c"]). */
export function splitList(text: string): string[] {
  return [...new Set(text.split(',').map((item) => item.trim()).filter(Boolean))]
}

export interface VerbFormsDraft {
  base: string
  thirdPerson: string
  /** Comma-separated: "learnt, learned". */
  pastSimple: string
  pastParticiple: string
  presentParticiple: string
  irregular: boolean
}

export interface EditorDraft {
  lemma: string
  ipa: string
  kind: EntryKind
  cefr: Cefr | ''
  senses: Sense[]
  verb: VerbFormsDraft | null
  noun: { plural: string; countability: 'countable' | 'uncountable' | 'both' } | null
  adjective: { comparative: string; superlative: string } | null
  family: FamilyMember[]
  synonyms: string
  antonyms: string
  collocations: string
  learnerNote: string
  usNote: string
  topicIds: string[]
  contexts: Context[]
}

export function entryToDraft(entry: Entry): EditorDraft {
  const verb = entry.forms?.verb
  const noun = entry.forms?.noun
  const adjective = entry.forms?.adjective
  return {
    lemma: entry.lemma,
    ipa: entry.ipa,
    kind: entry.kind,
    cefr: entry.cefr ?? '',
    senses: entry.senses.map((sense) => ({ ...sense, examples: sense.examples.map((example) => ({ ...example })) })),
    verb: verb
      ? {
          base: verb.base,
          thirdPerson: verb.thirdPerson,
          pastSimple: verb.pastSimple.join(', '),
          pastParticiple: verb.pastParticiple.join(', '),
          presentParticiple: verb.presentParticiple,
          irregular: verb.irregular,
        }
      : null,
    noun: noun ? { plural: noun.plural ?? '', countability: noun.countability } : null,
    adjective: adjective ? { comparative: adjective.comparative ?? '', superlative: adjective.superlative ?? '' } : null,
    family: entry.family.map((member) => ({ ...member })),
    synonyms: entry.synonyms.join(', '),
    antonyms: entry.antonyms.join(', '),
    collocations: entry.collocations.join(', '),
    learnerNote: entry.learnerNote ?? '',
    usNote: entry.usNote ?? '',
    topicIds: [...entry.topicIds],
    contexts: entry.contexts.map((context) => ({ ...context })),
  }
}

export function emptyEditorSense(): Sense {
  return { id: newId(), pos: 'noun', meaningEs: '', definitionEn: '', register: 'neutral', examples: [], matchesContext: false }
}

export function emptyVerbForms(): VerbFormsDraft {
  return { base: '', thirdPerson: '', pastSimple: '', pastParticiple: '', presentParticiple: '', irregular: false }
}

function buildForms(draft: EditorDraft): Forms | undefined {
  const forms: Forms = {}
  if (draft.verb && draft.verb.base.trim()) {
    forms.verb = {
      base: draft.verb.base.trim(),
      thirdPerson: draft.verb.thirdPerson.trim(),
      pastSimple: splitList(draft.verb.pastSimple),
      pastParticiple: splitList(draft.verb.pastParticiple),
      presentParticiple: draft.verb.presentParticiple.trim(),
      irregular: draft.verb.irregular,
    }
  }
  if (draft.noun) {
    const plural = draft.noun.plural.trim()
    forms.noun = { countability: draft.noun.countability, ...(plural ? { plural } : {}) }
  }
  if (draft.adjective) {
    const comparative = draft.adjective.comparative.trim()
    const superlative = draft.adjective.superlative.trim()
    if (comparative || superlative) {
      forms.adjective = { ...(comparative ? { comparative } : {}), ...(superlative ? { superlative } : {}) }
    }
  }
  return Object.keys(forms).length > 0 ? forms : undefined
}

/**
 * Applies the edited draft to the entry. Empty things disappear instead of being saved as empty
 * strings: blank senses, examples, family members, notes and forms.
 */
export function draftToEntry(entry: Entry, draft: EditorDraft): Entry {
  const { learnerNote: _learnerNote, usNote: _usNote, cefr: _cefr, forms: _forms, ...rest } = entry
  const forms = buildForms(draft)
  const learnerNote = draft.learnerNote.trim()
  const usNote = draft.usNote.trim()

  return {
    ...rest,
    lemma: draft.lemma.trim(),
    ipa: draft.ipa.trim(),
    kind: draft.kind,
    ...(draft.cefr ? { cefr: draft.cefr } : {}),
    senses: draft.senses
      .map((sense) => ({
        ...sense,
        meaningEs: sense.meaningEs.trim(),
        definitionEn: sense.definitionEn.trim(),
        examples: sense.examples
          .map((example) => ({
            en: example.en.trim(),
            es: example.es.trim(),
            ...(example.target?.trim() ? { target: example.target.trim() } : {}),
          }))
          .filter((example) => example.en),
      }))
      .filter((sense) => sense.meaningEs || sense.definitionEn),
    ...(forms ? { forms } : {}),
    family: draft.family
      .map((member) => ({ ...member, word: member.word.trim(), meaningEs: member.meaningEs.trim(), example: member.example.trim() }))
      .filter((member) => member.word),
    synonyms: splitList(draft.synonyms),
    antonyms: splitList(draft.antonyms),
    collocations: splitList(draft.collocations),
    ...(learnerNote ? { learnerNote } : {}),
    ...(usNote ? { usNote } : {}),
    topicIds: draft.topicIds.slice(0, 2),
    contexts: draft.contexts.flatMap(({ translationEs, ...context }) => {
      const sentence = context.sentence.trim()
      const translation = translationEs?.trim()
      return sentence ? [{ ...context, sentence, ...(translation ? { translationEs: translation } : {}) }] : []
    }),
  }
}
