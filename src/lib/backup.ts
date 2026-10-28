import { z } from 'zod'
import type { TableRecord } from '../db/bulk.ts'
import { db } from '../db/db.ts'
import {
  CardSchema,
  EntrySchema,
  GameResultSchema,
  ReviewLogSchema,
  SharedSettingsSchema,
  SourceSchema,
  StorySchema,
  SYNC_TABLES,
  TopicSchema,
  type SyncRecord,
  type SyncTableName,
} from '../shared/index.ts'

/** Marks the file as ours. */
export const BACKUP_APP = 'improve-your-vocabulary'
/** Version of the file format. A file with a higher number comes from a newer version of the app. */
export const BACKUP_SCHEMA_VERSION = 1

/**
 * The backup file (spec §10): every synced table, deleted records included (their `updatedAt` is
 * what makes a merge keep a deletion). The device settings are left out on purpose: they hold the
 * secret, and a file in iCloud Drive must not.
 */
export const BackupSchema = z.object({
  app: z.literal(BACKUP_APP),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.number().int().nonnegative(),
  tables: z.object({
    entries: z.array(EntrySchema),
    cards: z.array(CardSchema),
    logs: z.array(ReviewLogSchema),
    sources: z.array(SourceSchema),
    topics: z.array(TopicSchema),
    games: z.array(GameResultSchema),
    stories: z.array(StorySchema),
    sharedSettings: z.array(SharedSettingsSchema),
  }),
})
export type BackupFile = z.infer<typeof BackupSchema>

/** Reads every synced table into a backup. */
export async function buildBackup(now = Date.now()): Promise<BackupFile> {
  const read = <N extends SyncTableName>(name: N) => db.table<BackupFile['tables'][N][number], string>(name).toArray()
  const [entries, cards, logs, sources, topics, games, stories, sharedSettings] = await Promise.all([
    read('entries'),
    read('cards'),
    read('logs'),
    read('sources'),
    read('topics'),
    read('games'),
    read('stories'),
    read('sharedSettings'),
  ])
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now,
    tables: { entries, cards, logs, sources, topics, games, stories, sharedSettings },
  }
}

export function backupFileName(now: number): string {
  return `vocabulario-copia-${new Date(now).toISOString().slice(0, 10)}.json`
}

export type ParsedBackup = { ok: true; backup: BackupFile } | { ok: false; message: string }

/** Checks the text of a file chosen for import. The message is shown to the user as it is. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, message: 'El archivo no es una copia de seguridad: no es un JSON válido.' }
  }
  if (typeof raw !== 'object' || raw === null || (raw as { app?: unknown }).app !== BACKUP_APP) {
    return { ok: false, message: 'Este archivo no es una copia de seguridad de esta app.' }
  }
  const version = (raw as { schemaVersion?: unknown }).schemaVersion
  if (typeof version === 'number' && version > BACKUP_SCHEMA_VERSION) {
    return { ok: false, message: 'La copia es de una versión más nueva de la app. Actualiza la app e inténtalo de nuevo.' }
  }
  const parsed = BackupSchema.safeParse(raw)
  if (!parsed.success) {
    const [issue] = parsed.error.issues
    const where = issue ? issue.path.join('.') : ''
    return { ok: false, message: `La copia está dañada o incompleta${where ? ` (${where})` : ''}. No se ha importado nada.` }
  }
  return { ok: true, backup: parsed.data }
}

/** The records of a backup, ready to be applied. */
export function backupRecords(backup: BackupFile): TableRecord[] {
  return SYNC_TABLES.flatMap((table) => (backup.tables[table] as SyncRecord[]).map((record): TableRecord => ({ table, record })))
}

export interface BackupCounts {
  words: number
  cards: number
  reviews: number
  sources: number
  topics: number
  games: number
}

const active = (records: readonly { deletedAt?: number | undefined }[]) => records.filter((record) => record.deletedAt === undefined).length

/** What a backup holds, not counting deleted records. */
export function countBackup(backup: BackupFile): BackupCounts {
  const { tables } = backup
  return {
    words: active(tables.entries),
    cards: active(tables.cards),
    reviews: active(tables.logs),
    sources: active(tables.sources),
    topics: active(tables.topics),
    games: active(tables.games),
  }
}

/** What this device holds now, counted the same way. */
export async function countLocal(): Promise<BackupCounts> {
  return countBackup(await buildBackup())
}
