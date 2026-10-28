import { z } from 'zod'
import {
  CefrSchema,
  CountabilitySchema,
  EntryKindSchema,
  FamilyMemberSchema,
  PartOfSpeechSchema,
  RegisterSchema,
  VerbFormsSchema,
} from './model.js'

/*
 * Contract of POST /api/ai (spec §13), shared by the server and the client.
 *
 * The model-facing output schemas follow what structured outputs accept: closed objects, no
 * length constraints, and "empty" values ("" / [] / null) instead of optional fields.
 */

export const AI_LIMITS = {
  wordMax: 80,
  sentenceMax: 400,
  topicsMax: 50,
  sourceMax: 120,
  /** Total budget for one request, retries included. */
  timeoutMs: 25_000,
} as const

export const DEFAULT_AI_MODEL = 'claude-haiku-5-5'

/* ---------- Request ---------- */

export const ExistingTopicSchema = z.object({
  id: z.string().min(1).max(64),
  nameEs: z.string().min(1).max(80),
})
export type ExistingTopic = z.infer<typeof ExistingTopicSchema>

export const EnrichPayloadSchema = z.object({
  input: z.string().trim().min(1).max(AI_LIMITS.wordMax),
  context: z.string().trim().max(AI_LIMITS.sentenceMax).optional(),
  sourceTitle: z.string().trim().max(AI_LIMITS.sourceMax).optional(),
  existingTopics: z.array(ExistingTopicSchema).max(AI_LIMITS.topicsMax).default([]),
  mode: z.enum(['full', 'examples_only']).default('full'),
  /** examples_only: the senses whose examples must be rewritten (answered in the same order). */
  senses: z
    .array(z.object({ pos: PartOfSpeechSchema, meaningEs: z.string().max(200) }))
    .max(4)
    .optional(),
})
export type EnrichPayload = z.output<typeof EnrichPayloadSchema>
export type EnrichPayloadInput = z.input<typeof EnrichPayloadSchema>

export const AiRequestSchema = z.object({
  action: z.enum(['enrich', 'story']),
  payload: z.unknown(),
})

/* ---------- Model output ---------- */

const ModelExampleSchema = z.object({
  en: z.string(),
  es: z.string(),
  /** Exact substring of `en` that is the headword as inflected there. */
  target: z.string(),
})

const ModelSenseSchema = z.object({
  pos: PartOfSpeechSchema,
  meaningEs: z.string(),
  definitionEn: z.string(),
  register: RegisterSchema,
  examples: z.array(ModelExampleSchema),
  matchesContext: z.boolean(),
})

export const EnrichOutputSchema = z.object({
  lemma: z.string(),
  kind: EntryKindSchema,
  /** Spanish sentence such as "«went» es el pasado simple de «go»", or "" when the input was already the lemma. */
  inflectionNote: z.string(),
  ipa: z.string(),
  senses: z.array(ModelSenseSchema),
  forms: z.object({
    verb: VerbFormsSchema.nullable(),
    noun: z.object({ plural: z.string(), countability: CountabilitySchema }).nullable(),
    adjective: z.object({ comparative: z.string(), superlative: z.string() }).nullable(),
  }),
  family: z.array(FamilyMemberSchema),
  synonyms: z.array(z.string()),
  antonyms: z.array(z.string()),
  collocations: z.array(z.string()),
  learnerNote: z.string(),
  usNote: z.string(),
  cefr: z.enum([...CefrSchema.options, 'unknown']),
  /** Ids taken from the topics sent in the request. */
  topicIds: z.array(z.string()),
  newTopic: z.object({ nameEs: z.string(), emoji: z.string() }).nullable(),
  /** Full phrasal verb / idiom found around the word in the context sentence, or "". */
  alternativeUnit: z.string(),
  contextTranslationEs: z.string(),
  /** Exact fragment of the context sentence that corresponds to the word or unit, or "". */
  contextSurface: z.string(),
})
export type EnrichOutput = z.infer<typeof EnrichOutputSchema>

export const ExamplesOnlyOutputSchema = z.object({
  senses: z.array(z.object({ examples: z.array(ModelExampleSchema) })),
})
export type ExamplesOnlyOutput = z.infer<typeof ExamplesOnlyOutputSchema>

/* ---------- Response ---------- */

export const AI_ERROR_CODES = [
  'unauthorized',
  'bad_request',
  'not_configured',
  'server_misconfigured',
  'rate_limited',
  'billing',
  'timeout',
  'refused',
  'invalid_output',
  'upstream',
  'method_not_allowed',
  'not_implemented',
] as const
export const AiErrorCodeSchema = z.enum(AI_ERROR_CODES)
export type AiErrorCode = z.infer<typeof AiErrorCodeSchema>

export const AiErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.object({ code: AiErrorCodeSchema, message: z.string() }),
})
export type AiErrorResponse = z.infer<typeof AiErrorResponseSchema>

export const AiMetaSchema = z.object({
  model: z.string(),
  ms: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
})
export type AiMeta = z.infer<typeof AiMetaSchema>

export const EnrichResponseSchema = z.discriminatedUnion('mode', [
  z.object({ ok: z.literal(true), mode: z.literal('full'), data: EnrichOutputSchema, meta: AiMetaSchema }),
  z.object({
    ok: z.literal(true),
    mode: z.literal('examples_only'),
    data: ExamplesOnlyOutputSchema,
    meta: AiMetaSchema,
  }),
])
export type EnrichResponse = z.infer<typeof EnrichResponseSchema>

/* ---------- Normalisation ---------- */

const MAX_SENSES = 4
const MAX_EXAMPLES = 2

function cleanList(list: string[], max: number): string[] {
  return [...new Set(list.map((item) => item.trim()).filter(Boolean))].slice(0, max)
}

/**
 * Enforces the limits of the prompt (the model sometimes exceeds them) and tidies the output:
 * trimmed strings, at most 4 senses with the one that matches the context first, 2 examples each,
 * at most 2 topics and only ids that were actually offered.
 */
export function normalizeEnrich(
  output: EnrichOutput,
  request: { existingTopics: ExistingTopic[]; context?: string | undefined },
): EnrichOutput {
  const hasContext = Boolean(request.context?.trim())

  const cleaned = output.senses
    .map((sense) => ({
      ...sense,
      meaningEs: sense.meaningEs.trim(),
      definitionEn: sense.definitionEn.trim(),
      matchesContext: hasContext && sense.matchesContext,
      examples: sense.examples
        .map((example) => ({ en: example.en.trim(), es: example.es.trim(), target: example.target.trim() }))
        .filter((example) => example.en)
        .slice(0, MAX_EXAMPLES),
    }))
    .filter((sense) => sense.meaningEs || sense.definitionEn)

  const matching = cleaned.filter((sense) => sense.matchesContext)
  const others = cleaned.filter((sense) => !sense.matchesContext)
  // Only one sense can be "the one in my sentence": the first the model marked.
  const senses = [...matching.slice(0, 1), ...matching.slice(1).map((s) => ({ ...s, matchesContext: false })), ...others].slice(
    0,
    MAX_SENSES,
  )

  const offered = new Set(request.existingTopics.map((topic) => topic.id))
  const lemma = output.lemma.trim()
  const alternativeUnit = output.alternativeUnit.trim()
  const newTopicName = output.newTopic?.nameEs.trim() ?? ''

  return {
    ...output,
    lemma,
    inflectionNote: output.inflectionNote.trim(),
    ipa: output.ipa.trim(),
    senses,
    family: output.family
      .map((member) => ({ ...member, word: member.word.trim() }))
      .filter((member) => member.word)
      .slice(0, 6),
    synonyms: cleanList(output.synonyms, 4),
    antonyms: cleanList(output.antonyms, 4),
    collocations: cleanList(output.collocations, 5),
    learnerNote: output.learnerNote.trim(),
    usNote: output.usNote.trim(),
    topicIds: cleanList(
      output.topicIds.filter((id) => offered.has(id)),
      2,
    ),
    newTopic: output.newTopic && newTopicName ? { nameEs: newTopicName, emoji: output.newTopic.emoji.trim() } : null,
    alternativeUnit: alternativeUnit.toLowerCase() === lemma.toLowerCase() ? '' : alternativeUnit,
    contextTranslationEs: output.contextTranslationEs.trim(),
    contextSurface: output.contextSurface.trim(),
  }
}
