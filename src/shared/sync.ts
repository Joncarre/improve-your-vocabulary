import { z } from 'zod'
import {
  CardSchema,
  EntrySchema,
  GameResultSchema,
  ReviewLogSchema,
  SharedSettingsSchema,
  SourceSchema,
  StorySchema,
  SyncTableNameSchema,
  TopicSchema,
  type SyncTableName,
} from './model.js'

/*
 * Contract of POST /api/sync (spec §10), shared by the server and the client.
 *
 * The server keeps one row per record (`records`) and gives every change a new `seq`. The client
 * pushes what is in its outbox and pulls everything with a `seq` above its cursor.
 */

export const SYNC_LIMITS = {
  /** Records in one push. */
  pushRecords: 500,
  /** The client closes a push batch before it passes this many bytes of JSON (Vercel allows 4.5 MB). */
  pushBytes: 900_000,
  /** The server refuses bodies bigger than this. */
  bodyBytes: 2_000_000,
  /** Records in one pull page. */
  pullRecords: 500,
  /** A pull page stops before it passes this many bytes of JSON (the response limit is 4.5 MB). */
  pullBytes: 3_000_000,
  /** Sequence numbers the client asks again at the start of each pull (see PLAN R5). */
  pullOverlap: 50,
} as const

/** Schema of the `data` column for each table. */
export const RECORD_SCHEMAS = {
  entries: EntrySchema,
  cards: CardSchema,
  logs: ReviewLogSchema,
  sources: SourceSchema,
  topics: TopicSchema,
  games: GameResultSchema,
  stories: StorySchema,
  sharedSettings: SharedSettingsSchema,
} satisfies Record<SyncTableName, z.ZodType>

/** Any record of a synced table. */
export type SyncRecord = z.output<(typeof RECORD_SCHEMAS)[SyncTableName]>

/** What every synced record has in common: the fields the sync works with. */
export interface RecordMeta {
  id: string
  updatedAt: number
  deleted: boolean
}

export function metaOf(record: Pick<SyncRecord, 'id' | 'updatedAt' | 'deletedAt'>): RecordMeta {
  return { id: record.id, updatedAt: record.updatedAt, deleted: record.deletedAt !== undefined }
}

export type ParsedRecord = { ok: true; table: SyncTableName; record: SyncRecord } | { ok: false }

/** Validates one record of the wire format. */
export function parseSyncRecord(table: unknown, data: unknown): ParsedRecord {
  const name = SyncTableNameSchema.safeParse(table)
  if (!name.success) return { ok: false }
  const parsed = RECORD_SCHEMAS[name.data].safeParse(data)
  return parsed.success ? { ok: true, table: name.data, record: parsed.data } : { ok: false }
}

/**
 * Last write wins: an incoming record replaces the stored one only when it is strictly newer.
 * Equal timestamps keep what is there, so repeating a push or a pull changes nothing.
 */
export function isNewer(incomingUpdatedAt: number, currentUpdatedAt: number | undefined): boolean {
  return currentUpdatedAt === undefined || incomingUpdatedAt > currentUpdatedAt
}

/* ---------- Request ---------- */

export const SyncRowSchema = z.object({ table: SyncTableNameSchema, data: z.unknown() })
export type SyncRow = { table: SyncTableName; data: unknown }

export const SyncRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('push'), records: z.array(SyncRowSchema).max(SYNC_LIMITS.pushRecords) }),
  z.object({
    action: z.literal('pull'),
    cursor: z.number().int().nonnegative(),
    limit: z.number().int().min(1).max(SYNC_LIMITS.pullRecords).optional(),
  }),
])
export type SyncRequest = z.infer<typeof SyncRequestSchema>

/* ---------- Responses ---------- */

export const PushResponseSchema = z.object({
  ok: z.literal(true),
  action: z.literal('push'),
  /** Records that were stored (the rest were not newer than what the server has). */
  applied: z.number().int().nonnegative(),
  /** Positions in the request of the records that are not valid and were not stored. */
  rejected: z.array(z.number().int().nonnegative()),
})
export type PushResponse = z.infer<typeof PushResponseSchema>

export const PullResponseSchema = z.object({
  ok: z.literal(true),
  action: z.literal('pull'),
  records: z.array(SyncRowSchema),
  /** Highest `seq` in this page (the request's cursor when the page is empty). */
  cursor: z.number().int().nonnegative(),
  /** Highest `seq` on the server; below the client's cursor means the database was emptied or replaced. */
  latest: z.number().int().nonnegative(),
  hasMore: z.boolean(),
})
export type PullResponse = z.infer<typeof PullResponseSchema>

export const SYNC_ERROR_CODES = [
  'unauthorized',
  'bad_request',
  'payload_too_large',
  'method_not_allowed',
  'not_configured',
  'server_misconfigured',
  'database',
] as const
export type SyncErrorCode = (typeof SYNC_ERROR_CODES)[number]

export const SyncErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.object({ code: z.enum(SYNC_ERROR_CODES), message: z.string() }),
})
