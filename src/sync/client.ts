import {
  PullResponseSchema,
  PushResponseSchema,
  SyncErrorResponseSchema,
  type PullResponse,
  type PushResponse,
  type SyncErrorCode,
  type SyncRequest,
} from '../shared/index.ts'

/** A request is cut off after this long (a push can carry ~1 MB over a slow connection). */
const REQUEST_TIMEOUT_MS = 30_000

export type SyncClientErrorCode = SyncErrorCode | 'network' | 'timeout' | 'invalid_response'

/** Failures that go away by themselves (no connection, a slow or briefly unavailable server). */
const TEMPORARY: ReadonlySet<SyncClientErrorCode> = new Set(['network', 'timeout', 'database', 'invalid_response'])

export class SyncError extends Error {
  readonly code: SyncClientErrorCode
  readonly temporary: boolean

  constructor(code: SyncClientErrorCode, message: string) {
    super(message)
    this.name = 'SyncError'
    this.code = code
    this.temporary = TEMPORARY.has(code)
  }
}

export interface CallOptions {
  /** APP_SECRET of this device (Ajustes). */
  secret: string
  signal?: AbortSignal
  /** Replaceable for tests. */
  fetchImpl?: typeof fetch
}

async function call(request: SyncRequest, options: CallOptions): Promise<unknown> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true })

  let response: Response
  try {
    response = await (options.fetchImpl ?? fetch)('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-secret': options.secret },
      body: JSON.stringify(request),
      signal: controller.signal,
    })
  } catch (error) {
    if (timedOut) throw new SyncError('timeout', 'El servidor ha tardado demasiado en responder.')
    if (options.signal?.aborted) throw error
    throw new SyncError('network', 'No se ha podido conectar con el servidor.')
  } finally {
    clearTimeout(timer)
  }

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const failure = SyncErrorResponseSchema.safeParse(body)
    if (failure.success) throw new SyncError(failure.data.error.code, failure.data.error.message)
    throw new SyncError('invalid_response', `El servidor ha respondido con un error (HTTP ${response.status}).`)
  }
  return body
}

export async function pushRecords(records: Extract<SyncRequest, { action: 'push' }>['records'], options: CallOptions): Promise<PushResponse> {
  const parsed = PushResponseSchema.safeParse(await call({ action: 'push', records }, options))
  if (!parsed.success) throw new SyncError('invalid_response', 'La respuesta del servidor no es válida.')
  return parsed.data
}

export async function pullRecords(cursor: number, limit: number | undefined, options: CallOptions): Promise<PullResponse> {
  const parsed = PullResponseSchema.safeParse(await call({ action: 'pull', cursor, ...(limit === undefined ? {} : { limit }) }, options))
  if (!parsed.success) throw new SyncError('invalid_response', 'La respuesta del servidor no es válida.')
  return parsed.data
}
