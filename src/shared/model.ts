import { z } from 'zod'

/*
 * Data model (spec §4). These Zod schemas are the single source of truth: the TypeScript types
 * are inferred from them, and the same schemas validate imports and server payloads.
 *
 * Relative imports inside src/shared and api/ use explicit ".js" extensions so the same files
 * run unchanged under Node ESM (Vercel Functions), Vite and Vitest (see DECISIONS.md).
 */

const id = z.string().min(1)
/** Milliseconds since the Unix epoch. */
const timestamp = z.number().int().nonnegative()
/** Fields every synced record carries: last-write-wins clock and logical deletion. */
const syncFields = { updatedAt: timestamp, deletedAt: timestamp.optional() }

/** Tables that are synchronised between devices (`deviceSettings` and `outbox` stay local). */
export const SYNC_TABLES = [
  'entries',
  'cards',
  'logs',
  'sources',
  'topics',
  'games',
  'stories',
  'sharedSettings',
] as const
export const SyncTableNameSchema = z.enum(SYNC_TABLES)
export type SyncTableName = z.infer<typeof SyncTableNameSchema>

/* ---------- Vocabulary entries ---------- */

export const PartOfSpeechSchema = z.enum([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'preposition',
  'conjunction',
  'pronoun',
  'determiner',
  'interjection',
  'phrasal_verb',
  'idiom',
  'expression',
])
export type PartOfSpeech = z.infer<typeof PartOfSpeechSchema>

export const RegisterSchema = z.enum(['neutral', 'formal', 'informal', 'slang', 'offensive', 'old_fashioned'])
export type Register = z.infer<typeof RegisterSchema>

export const CefrSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
export type Cefr = z.infer<typeof CefrSchema>

export const EntryKindSchema = z.enum(['word', 'phrasal_verb', 'idiom', 'expression'])
export type EntryKind = z.infer<typeof EntryKindSchema>

export const EntryStatusSchema = z.enum(['active', 'archived', 'pending_ai'])
export type EntryStatus = z.infer<typeof EntryStatusSchema>

export const ExampleSchema = z.object({
  en: z.string(),
  es: z.string(),
  /** Exact surface form of the target word inside `en` (used to build gaps reliably). */
  target: z.string().optional(),
})
export type Example = z.infer<typeof ExampleSchema>

export const SenseSchema = z.object({
  id,
  pos: PartOfSpeechSchema,
  meaningEs: z.string(),
  definitionEn: z.string(),
  register: RegisterSchema,
  examples: z.array(ExampleSchema),
  /** True for the sense used in the sentence where the word was found. */
  matchesContext: z.boolean(),
})
export type Sense = z.infer<typeof SenseSchema>

export const CountabilitySchema = z.enum(['countable', 'uncountable', 'both'])

export const VerbFormsSchema = z.object({
  base: z.string(),
  thirdPerson: z.string(),
  /** British variant first: ["learnt", "learned"]. */
  pastSimple: z.array(z.string()),
  pastParticiple: z.array(z.string()),
  presentParticiple: z.string(),
  irregular: z.boolean(),
})

export const FormsSchema = z.object({
  verb: VerbFormsSchema.optional(),
  noun: z
    .object({
      plural: z.string().optional(),
      countability: z.enum(['countable', 'uncountable', 'both']),
    })
    .optional(),
  adjective: z
    .object({
      comparative: z.string().optional(),
      superlative: z.string().optional(),
    })
    .optional(),
})
export type Forms = z.infer<typeof FormsSchema>

export const FamilyMemberSchema = z.object({
  word: z.string(),
  pos: PartOfSpeechSchema,
  meaningEs: z.string(),
  example: z.string(),
})
export type FamilyMember = z.infer<typeof FamilyMemberSchema>

export const ContextSchema = z.object({
  id,
  /** The sentence as it was seen or heard. */
  sentence: z.string(),
  translationEs: z.string().optional(),
  /** Exact fragment of `sentence` that corresponds to the word or unit (used for highlighting). */
  surface: z.string().optional(),
  sourceId: z.string().optional(),
  /** "S2 E5", "min 34", "cap. 3". */
  detail: z.string().optional(),
  addedAt: timestamp,
})
export type Context = z.infer<typeof ContextSchema>

export const EntrySchema = z.object({
  id,
  lemma: z.string().min(1),
  lemmaKey: z.string().min(1),
  /** What was typed when it was an inflected form ("went" for the lemma "go"). */
  seenForm: z.string().optional(),
  kind: EntryKindSchema,
  /** British RP between slashes: "/ɡəʊ/". */
  ipa: z.string(),
  audioUrl: z.string().optional(),
  /** When the free dictionary was last asked for a UK recording, so words without one are not asked again. */
  audioCheckedAt: timestamp.optional(),
  senses: z.array(SenseSchema),
  forms: FormsSchema.optional(),
  family: z.array(FamilyMemberSchema),
  synonyms: z.array(z.string()),
  antonyms: z.array(z.string()),
  collocations: z.array(z.string()),
  learnerNote: z.string().optional(),
  usNote: z.string().optional(),
  cefr: CefrSchema.optional(),
  topicIds: z.array(z.string()),
  contexts: z.array(ContextSchema),
  status: EntryStatusSchema,
  isLeech: z.boolean(),
  createdAt: timestamp,
  ...syncFields,
})
export type Entry = z.infer<typeof EntrySchema>

export const SourceSchema = z.object({
  id,
  title: z.string().min(1),
  type: z.enum(['series', 'film', 'book', 'podcast', 'video', 'other']),
  lastUsedAt: timestamp,
  ...syncFields,
})
export type Source = z.infer<typeof SourceSchema>

export const TopicSchema = z.object({
  id,
  nameEs: z.string().min(1),
  emoji: z.string(),
  /** A colour from the pastel palette. */
  color: z.string(),
  ...syncFields,
})
export type Topic = z.infer<typeof TopicSchema>

/* ---------- Cards, logs and games ---------- */

/** ts-fsrs `Card` with its dates serialised as millisecond timestamps. */
export const FsrsCardSchema = z.object({
  due: timestamp,
  stability: z.number(),
  difficulty: z.number(),
  /** Deprecated in ts-fsrs 5.x (removed in 6.0): kept optional-with-default for forward compatibility. */
  elapsed_days: z.number().default(0),
  scheduled_days: z.number(),
  learning_steps: z.number().int(),
  reps: z.number().int(),
  lapses: z.number().int(),
  /** ts-fsrs `State`: 0 New, 1 Learning, 2 Review, 3 Relearning. */
  state: z.number().int().min(0).max(3),
  last_review: timestamp.optional(),
})
export type FsrsCard = z.infer<typeof FsrsCardSchema>

export const CardStatsSchema = z.object({
  seen: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  wrong: z.number().int().nonnegative(),
  /** Consecutive successes; back to 0 on a failure. */
  streak: z.number().int().nonnegative(),
  lastSeenAt: timestamp.optional(),
})
export type CardStats = z.infer<typeof CardStatsSchema>

export const CardSchema = z.object({
  id,
  entryId: id,
  /** recognition = EN to ES, production = ES to EN. */
  type: z.enum(['recognition', 'production']),
  fsrs: FsrsCardSchema,
  /** Indexable copy of `fsrs.due`. */
  due: timestamp,
  /** The production card unlocks once the recognition card leaves the learning phase. */
  unlocked: z.boolean(),
  suspended: z.boolean(),
  stats: CardStatsSchema,
  ...syncFields,
})
export type Card = z.infer<typeof CardSchema>

export const GameIdSchema = z.enum([
  'match',
  'cloze',
  'verb_forms',
  'family',
  'dictation',
  'connections',
  'story',
])
export type GameId = z.infer<typeof GameIdSchema>

export const ReviewLogSchema = z.object({
  id,
  cardId: id,
  entryId: id,
  at: timestamp,
  /** `extra` = review outside the FSRS calendar ("Repasar esta serie"). */
  origin: z.union([z.literal('review'), z.literal('extra'), z.templateLiteral(['game:', GameIdSchema])]),
  /** Only on reviews: 1 Again, 2 Hard, 3 Good, 4 Easy. */
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  correct: z.boolean(),
  /** Response time in milliseconds. */
  ms: z.number().nonnegative(),
  /** ts-fsrs ReviewLog, kept for undo and future parameter optimisation. */
  fsrsLog: z.unknown().optional(),
  ...syncFields,
})
export type ReviewLog = z.infer<typeof ReviewLogSchema>

export const GameResultSchema = z.object({
  id,
  game: GameIdSchema,
  at: timestamp,
  score: z.number(),
  total: z.number(),
  durationMs: z.number().nonnegative(),
  /** Which version of the game was played ("ipa", "type"...): personal records are kept per variant. */
  variant: z.string().optional(),
  ...syncFields,
})
export type GameResult = z.infer<typeof GameResultSchema>

/** A generated micro-story, stored so it is never requested twice (game "Historia"). */
export const StorySchema = z.object({
  id,
  title: z.string(),
  textEn: z.string(),
  textEs: z.string(),
  targets: z.array(
    z.object({
      lemma: z.string(),
      surfaceForm: z.string(),
      start: z.number().int().nonnegative(),
      end: z.number().int().nonnegative(),
    }),
  ),
  entryIds: z.array(z.string()),
  level: z.string(),
  createdAt: timestamp,
  /** When the gaps were completed: a story without it is still waiting to be played, and is used before asking for another. */
  playedAt: timestamp.optional(),
  ...syncFields,
})
export type Story = z.infer<typeof StorySchema>

/* ---------- Settings and sync bookkeeping ---------- */

/** Settings shared by every device (synced). One record with id "shared". */
export const SharedSettingsSchema = z.object({
  id: z.literal('shared'),
  newPerDay: z.number().int().min(0).max(100),
  desiredRetention: z.number().min(0.85).max(0.95),
  productionEnabled: z.boolean(),
  /** Hour (0-23) at which the study day starts. */
  dayStartHour: z.number().int().min(0).max(23),
  showSentenceOnFront: z.boolean(),
  ...syncFields,
})
export type SharedSettings = z.infer<typeof SharedSettingsSchema>

/** Settings that only make sense on this device (never synced). One record with id "device". */
export const DeviceSettingsSchema = z.object({
  id: z.literal('device'),
  autoPlayAudio: z.boolean(),
  voiceURI: z.string().optional(),
  voiceRate: z.number().min(0.5).max(1.5),
  /** Value of APP_SECRET; sent in the `x-app-secret` header. */
  appSecret: z.string(),
  /** Highest server `seq` already pulled. */
  syncCursor: z.number().int().nonnegative(),
  lastSyncAt: timestamp.optional(),
  lastSyncOkAt: timestamp.optional(),
  onboardingDone: z.boolean(),
  installGuideDismissed: z.boolean(),
  /** Whether the review is in backlog mode (many reviews piled up: no new cards until it is down to 50). */
  backlogMode: z.boolean().optional(),
})
export type DeviceSettings = z.infer<typeof DeviceSettingsSchema>

/** Pending upload: which record changed and when it was queued. */
export const OutboxItemSchema = z.object({
  table: SyncTableNameSchema,
  id,
  queuedAt: timestamp,
})
export type OutboxItem = z.infer<typeof OutboxItemSchema>
