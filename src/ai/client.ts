import {
  AiErrorResponseSchema,
  EnrichResponseSchema,
  type AiErrorCode,
  type EnrichOutput,
  type EnrichPayloadInput,
  type EnrichResponse,
} from '../shared/index.ts'

/** The browser gives up slightly after the server's own 25 s budget. */
const CLIENT_TIMEOUT_MS = 30_000

export type AiClientErrorCode = AiErrorCode | 'network'

/** Failures worth trying again later (the entry can wait as `pending_ai`). */
const RETRYABLE: ReadonlySet<AiClientErrorCode> = new Set(['network', 'timeout', 'rate_limited', 'upstream', 'invalid_output'])

export class AiError extends Error {
  readonly code: AiClientErrorCode
  readonly retryable: boolean

  constructor(code: AiClientErrorCode, message: string) {
    super(message)
    this.name = 'AiError'
    this.code = code
    this.retryable = RETRYABLE.has(code)
  }
}

export interface RequestOptions {
  /** APP_SECRET of this device (Ajustes). */
  secret: string
  signal?: AbortSignal
  /** Replaceable for tests. */
  fetchImpl?: typeof fetch
  online?: boolean
}

function isOnline(options: RequestOptions): boolean {
  if (options.online !== undefined) return options.online
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export async function callAi(payload: EnrichPayloadInput, options: RequestOptions): Promise<EnrichResponse> {
  if (!options.secret.trim()) throw new AiError('unauthorized', 'Falta el secreto: introdúcelo en Ajustes.')
  if (!isOnline(options)) throw new AiError('network', 'Sin conexión.')

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, CLIENT_TIMEOUT_MS)
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true })

  let response: Response
  try {
    response = await (options.fetchImpl ?? fetch)('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-secret': options.secret },
      body: JSON.stringify({ action: 'enrich', payload }),
      signal: controller.signal,
    })
  } catch (error) {
    if (timedOut) throw new AiError('timeout', 'La IA ha tardado demasiado en responder.')
    if (options.signal?.aborted) throw error
    throw new AiError('network', 'No se ha podido conectar con el servidor.')
  } finally {
    clearTimeout(timer)
  }

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const failure = AiErrorResponseSchema.safeParse(body)
    if (failure.success) throw new AiError(failure.data.error.code, failure.data.error.message)
    throw new AiError('upstream', `El servidor ha respondido con un error (HTTP ${response.status}).`)
  }

  const parsed = EnrichResponseSchema.safeParse(body)
  if (!parsed.success) throw new AiError('invalid_output', 'La respuesta de la IA no es válida.')
  return parsed.data
}

/** Full dictionary entry for a word, with the sense used in its context sentence first. */
export async function requestEnrich(payload: EnrichPayloadInput, options: RequestOptions): Promise<EnrichOutput> {
  const response = await callAi({ ...payload, mode: 'full' }, options)
  if (response.mode !== 'full') throw new AiError('invalid_output', 'La respuesta de la IA no es válida.')
  return response.data
}
