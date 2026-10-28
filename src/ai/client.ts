import {
  AiErrorResponseSchema,
  EnrichResponseSchema,
  normalizeStory,
  StoryResponseSchema,
  storyTargetsNeeded,
  type AiErrorCode,
  type EnrichOutput,
  type EnrichPayloadInput,
  type EnrichResponse,
  type StoryOutput,
  type StoryPayloadInput,
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

/** One request to /api/ai: the answer's JSON, or an AiError with the server's own Spanish message. */
async function postAi(action: 'enrich' | 'story', payload: unknown, options: RequestOptions): Promise<unknown> {
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
      body: JSON.stringify({ action, payload }),
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
  return body
}

export async function callAi(payload: EnrichPayloadInput, options: RequestOptions): Promise<EnrichResponse> {
  const parsed = EnrichResponseSchema.safeParse(await postAi('enrich', payload, options))
  if (!parsed.success) throw new AiError('invalid_output', 'La respuesta de la IA no es válida.')
  return parsed.data
}

/**
 * A micro-story with the given words (spec §13). The words are found again in the text here, on the device,
 * instead of trusting the positions the model counted (risk R12), and the story is refused when too few are left.
 */
export async function requestStory(payload: StoryPayloadInput, options: RequestOptions): Promise<StoryOutput> {
  const parsed = StoryResponseSchema.safeParse(await postAi('story', payload, options))
  if (!parsed.success) throw new AiError('invalid_output', 'La respuesta de la IA no es válida.')
  const story = normalizeStory(parsed.data.data, payload.words)
  if (!story.textEn || story.targets.length < storyTargetsNeeded(payload.words.length)) {
    throw new AiError('invalid_output', 'La historia no usa las palabras pedidas.')
  }
  return story
}

/** Full dictionary entry for a word, with the sense used in its context sentence first. */
export async function requestEnrich(payload: EnrichPayloadInput, options: RequestOptions): Promise<EnrichOutput> {
  const response = await callAi({ ...payload, mode: 'full' }, options)
  if (response.mode !== 'full') throw new AiError('invalid_output', 'La respuesta de la IA no es válida.')
  return response.data
}
