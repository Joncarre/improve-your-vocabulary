import type { DictionaryResult } from '../../lib/dictionary.ts'
import { newId } from '../../lib/id.ts'
import { normalizeLemmaKey } from '../../lib/lemmaKey.ts'
import type {
  Cefr,
  EnrichOutput,
  EntryKind,
  Example,
  FamilyMember,
  Forms,
  PartOfSpeech,
  Register,
} from '../../shared/index.ts'

export interface DraftSense {
  id: string
  pos: PartOfSpeech
  meaningEs: string
  definitionEn: string
  register: Register
  examples: Example[]
  matchesContext: boolean
}

/** Where the data of a draft came from: the AI, the free dictionary, or typed by hand. */
export type DraftOrigin = 'ai' | 'dictionary' | 'manual'

/** The editable preview of an entry, before it is saved. */
export interface EntryDraft {
  lemma: string
  kind: EntryKind
  /** What was typed when it was an inflected form ("went" for "go"); "" otherwise. */
  seenForm: string
  inflectionNote: string
  ipa: string
  audioUrl: string
  senses: DraftSense[]
  forms: Forms | undefined
  family: FamilyMember[]
  synonyms: string[]
  antonyms: string[]
  collocations: string[]
  learnerNote: string
  usNote: string
  cefr: Cefr | undefined
  topicIds: string[]
  /** A topic the AI proposed because none of the existing ones fit; created on save. */
  newTopic: { nameEs: string; emoji: string } | null
  contextTranslationEs: string
  contextSurface: string
  /** Full phrasal verb / idiom found in the sentence ("go off on one"), "" when there is none. */
  alternativeUnit: string
  origin: DraftOrigin
}

export function emptySense(pos: PartOfSpeech = 'noun'): DraftSense {
  return { id: newId(), pos, meaningEs: '', definitionEn: '', register: 'neutral', examples: [], matchesContext: false }
}

function buildForms(forms: EnrichOutput['forms']): Forms | undefined {
  const result: Forms = {}
  if (forms.verb) result.verb = forms.verb
  if (forms.noun) {
    result.noun = { countability: forms.noun.countability, ...(forms.noun.plural ? { plural: forms.noun.plural } : {}) }
  }
  if (forms.adjective) {
    const { comparative, superlative } = forms.adjective
    if (comparative || superlative) {
      result.adjective = { ...(comparative ? { comparative } : {}), ...(superlative ? { superlative } : {}) }
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

export function buildDraftFromAi(output: EnrichOutput, typed: string): EntryDraft {
  const typedText = typed.trim()
  const inflected = normalizeLemmaKey(typedText) !== normalizeLemmaKey(output.lemma)
  return {
    lemma: output.lemma,
    kind: output.kind,
    seenForm: inflected ? typedText : '',
    inflectionNote: output.inflectionNote,
    ipa: output.ipa,
    audioUrl: '',
    senses: output.senses.map((sense) => ({ ...sense, id: newId() })),
    forms: buildForms(output.forms),
    family: output.family,
    synonyms: output.synonyms,
    antonyms: output.antonyms,
    collocations: output.collocations,
    learnerNote: output.learnerNote,
    usNote: output.usNote,
    cefr: output.cefr === 'unknown' ? undefined : output.cefr,
    topicIds: output.topicIds,
    newTopic: output.newTopic,
    contextTranslationEs: output.contextTranslationEs,
    contextSurface: output.contextSurface,
    alternativeUnit: output.alternativeUnit,
    origin: 'ai',
  }
}

/**
 * Draft for when the AI is not available: what the free dictionary knows (IPA, English
 * definitions, UK audio) and blank Spanish meanings for the user to type.
 */
export function buildDraftFromDictionary(typed: string, result: DictionaryResult | null): EntryDraft {
  const lemma = typed.trim()
  const senses: DraftSense[] =
    result && result.senses.length > 0
      ? result.senses.map((sense) => ({ ...emptySense(sense.pos), definitionEn: sense.definitionEn, examples: sense.examples }))
      : [emptySense(lemma.includes(' ') ? 'expression' : 'noun')]
  return {
    lemma,
    kind: lemma.includes(' ') ? 'expression' : 'word',
    seenForm: '',
    inflectionNote: '',
    ipa: result?.ipa ?? '',
    audioUrl: result?.audioUrl ?? '',
    senses,
    forms: undefined,
    family: [],
    synonyms: result?.synonyms ?? [],
    antonyms: result?.antonyms ?? [],
    collocations: [],
    learnerNote: '',
    usNote: '',
    cefr: undefined,
    topicIds: [],
    newTopic: null,
    contextTranslationEs: '',
    contextSurface: '',
    alternativeUnit: '',
    origin: result ? 'dictionary' : 'manual',
  }
}

/** A sense is worth keeping when it says something. */
export function senseHasContent(sense: DraftSense): boolean {
  return Boolean(sense.meaningEs.trim() || sense.definitionEn.trim())
}

/**
 * Whether the draft can be saved. An entry that will be completed later (`pending_ai`) only needs
 * its word; one that will not (it is final) needs at least a meaning.
 */
export function canSaveDraft(draft: EntryDraft, status: 'active' | 'pending_ai'): boolean {
  if (!draft.lemma.trim()) return false
  if (status === 'pending_ai') return true
  return draft.senses.some((sense) => sense.meaningEs.trim())
}
