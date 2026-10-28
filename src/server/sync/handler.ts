import {
  SYNC_LIMITS,
  SyncRequestSchema,
  type PullResponse,
  type PushResponse,
  type SyncErrorCode,
} from '../../shared/index.js'
import { secretsMatch } from '../auth.js'
import { createNeonStore } from './neonStore.js'
import { fitPage, preparePush, type RecordStore } from './store.js'

export interface SyncEnv {
  APP_SECRET?: string | undefined
  DATABASE_URL?: string | undefined
  /** Tests only: another table name, so they never touch the real records. */
  SYNC_TABLE?: string | undefined
}

export interface SyncHandlerDeps {
  env: SyncEnv
  createStore: (databaseUrl: string, table?: string) => RecordStore
}

const STATUS: Record<SyncErrorCode, number> = {
  unauthorized: 401,
  bad_request: 400,
  payload_too_large: 413,
  method_not_allowed: 405,
  not_configured: 503,
  server_misconfigured: 500,
  database: 502,
}

/** User-facing messages (Spanish: the interface shows them as they are). */
const MESSAGE: Record<SyncErrorCode, string> = {
  unauthorized: 'Secreto incorrecto o ausente. Revísalo en Ajustes.',
  bad_request: 'La petición no es válida.',
  payload_too_large: 'La petición es demasiado grande.',
  method_not_allowed: 'Método no permitido.',
  not_configured: 'La sincronización no está configurada en el servidor (falta la base de datos).',
  server_misconfigured: 'El servidor no está bien configurado: revisa las variables de entorno.',
  database: 'No se ha podido contactar con la base de datos. Inténtalo de nuevo.',
}

function json(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function failure(code: SyncErrorCode, message = MESSAGE[code]): Response {
  return json(STATUS[code], { ok: false, error: { code, message } })
}

/** The table is created on the first request that reaches a server instance (decision B11). */
const schemaReady = new WeakMap<RecordStore, Promise<void>>()

function ensureSchema(store: RecordStore): Promise<void> {
  let ready = schemaReady.get(store)
  if (!ready) {
    ready = store.ensureSchema()
    schemaReady.set(store, ready)
    // A failure must not be remembered: the next request tries again.
    ready.catch(() => schemaReady.delete(store))
  }
  return ready
}

/**
 * POST /api/sync. Order matters: method, then secret (nothing else is looked at without it), then
 * server configuration, then the body.
 */
export async function handleSyncRequest(request: Request, deps: SyncHandlerDeps): Promise<Response> {
  const { env } = deps
  if (request.method !== 'POST') return failure('method_not_allowed')

  if (!env.APP_SECRET) return failure('server_misconfigured')
  if (!secretsMatch(request.headers.get('x-app-secret'), env.APP_SECRET)) return failure('unauthorized')

  if (!env.DATABASE_URL) return failure('not_configured')

  const text = await request.text()
  if (text.length > SYNC_LIMITS.bodyBytes) return failure('payload_too_large')

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return failure('bad_request', 'El cuerpo de la petición no es JSON válido.')
  }
  const parsed = SyncRequestSchema.safeParse(raw)
  if (!parsed.success) return failure('bad_request')

  try {
    const store = deps.createStore(env.DATABASE_URL, env.SYNC_TABLE || undefined)
    await ensureSchema(store)

    if (parsed.data.action === 'push') {
      const { rows, rejected } = preparePush(parsed.data.records)
      const body: PushResponse = { ok: true, action: 'push', applied: await store.upsert(rows), rejected }
      return json(200, body)
    }

    const { cursor, limit = SYNC_LIMITS.pullRecords } = parsed.data
    const page = await store.pull(cursor, limit)
    const rows = fitPage(page.rows, SYNC_LIMITS.pullBytes)
    const last = rows.at(-1)?.seq ?? cursor
    const body: PullResponse = {
      ok: true,
      action: 'pull',
      records: rows.map((row) => ({ table: row.table, data: row.data })),
      cursor: last,
      latest: page.latest,
      hasMore: page.latest > last,
    }
    return json(200, body)
  } catch (error) {
    // Never echo database details to the client (they can name tables or hosts).
    console.error('[api/sync] unexpected error', error instanceof Error ? error.message : error)
    return failure('database')
  }
}

/** One store per server instance, so the schema check runs once and not on every request. */
const stores = new Map<string, RecordStore>()

function cachedNeonStore(databaseUrl: string, table = 'records'): RecordStore {
  const key = `${table}|${databaseUrl}`
  let store = stores.get(key)
  if (!store) {
    store = createNeonStore(databaseUrl, table)
    stores.set(key, store)
  }
  return store
}

/** Real dependencies: reads the environment on every call so `.env.local` changes apply in dev. */
export function productionSyncDeps(): SyncHandlerDeps {
  return {
    env: {
      APP_SECRET: process.env.APP_SECRET,
      DATABASE_URL: process.env.DATABASE_URL,
      SYNC_TABLE: process.env.SYNC_TABLE,
    },
    createStore: cachedNeonStore,
  }
}
