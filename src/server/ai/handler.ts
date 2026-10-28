import {
  AI_ERROR_CODES,
  AI_LIMITS,
  AiRequestSchema,
  DEFAULT_AI_MODEL,
  EnrichPayloadSchema,
  STORY_WORDS,
  StoryPayloadSchema,
  type AiErrorCode,
} from '../../shared/index.js'
import { secretsMatch } from '../auth.js'
import { createAnthropicCall } from './anthropic.js'
import { runAi, type StructuredCall } from './enrich.js'
import { AiFailure } from './errors.js'
import { runStory } from './story.js'

export interface AiEnv {
  APP_SECRET?: string | undefined
  ANTHROPIC_API_KEY?: string | undefined
  ANTHROPIC_MODEL?: string | undefined
}

export interface AiHandlerDeps {
  env: AiEnv
  /** Builds the model call; replaced in tests. */
  createCall: (apiKey: string, model: string) => StructuredCall
}

/** Request bodies are tiny (a word, a sentence, a topic list): anything bigger is not ours. */
const MAX_BODY_CHARS = 20_000

function json(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function failure(error: AiFailure): Response {
  return json(error.status, { ok: false, error: { code: error.code, message: error.message } })
}

const KNOWN_CODES: readonly string[] = AI_ERROR_CODES

/** Spanish description of the first thing wrong with a payload. */
function describeInvalidPayload(issuePath: PropertyKey[]): string {
  const [field] = issuePath
  switch (field) {
    case 'input':
      return `La palabra o expresión es obligatoria y no puede pasar de ${AI_LIMITS.wordMax} caracteres.`
    case 'context':
      return `La frase no puede pasar de ${AI_LIMITS.sentenceMax} caracteres.`
    case 'existingTopics':
      return `La lista de temas no puede pasar de ${AI_LIMITS.topicsMax} elementos.`
    default:
      return 'La petición no es válida.'
  }
}

function describeInvalidStoryPayload(issuePath: PropertyKey[]): string {
  const [field] = issuePath
  switch (field) {
    case 'words':
      return `La lista de palabras debe tener entre ${STORY_WORDS.min} y ${STORY_WORDS.max} elementos, cada uno de no más de ${AI_LIMITS.wordMax} caracteres.`
    case 'level':
      return 'El nivel debe ser uno de A1, A2, B1, B2, C1 o C2.'
    default:
      return 'La petición no es válida.'
  }
}

/**
 * POST /api/ai. Order matters: method, then secret (nothing else is looked at without it), then
 * server configuration, then the body.
 */
export async function handleAiRequest(request: Request, deps: AiHandlerDeps): Promise<Response> {
  const { env } = deps
  if (request.method !== 'POST') return failure(new AiFailure('method_not_allowed'))

  if (!env.APP_SECRET) return failure(new AiFailure('server_misconfigured'))
  if (!secretsMatch(request.headers.get('x-app-secret'), env.APP_SECRET)) return failure(new AiFailure('unauthorized'))

  if (!env.ANTHROPIC_API_KEY) return failure(new AiFailure('not_configured'))

  const text = await request.text()
  if (text.length > MAX_BODY_CHARS) return failure(new AiFailure('bad_request', 'La petición es demasiado grande.'))

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return failure(new AiFailure('bad_request', 'El cuerpo de la petición no es JSON válido.'))
  }

  const parsed = AiRequestSchema.safeParse(raw)
  if (!parsed.success) return failure(new AiFailure('bad_request'))

  // Each action checks its own payload; the model call is only built once the request is known to be good.
  let run: (call: StructuredCall, model: string) => Promise<unknown>
  if (parsed.data.action === 'story') {
    const payload = StoryPayloadSchema.safeParse(parsed.data.payload)
    if (!payload.success) {
      const [issue] = payload.error.issues
      return failure(new AiFailure('bad_request', describeInvalidStoryPayload(issue?.path ?? [])))
    }
    run = (call, model) => runStory(payload.data, call, model)
  } else {
    const payload = EnrichPayloadSchema.safeParse(parsed.data.payload)
    if (!payload.success) {
      const [issue] = payload.error.issues
      return failure(new AiFailure('bad_request', describeInvalidPayload(issue?.path ?? [])))
    }
    run = (call, model) => runAi(payload.data, call, model)
  }

  try {
    const model = env.ANTHROPIC_MODEL || DEFAULT_AI_MODEL
    return json(200, await run(deps.createCall(env.ANTHROPIC_API_KEY, model), model))
  } catch (error) {
    if (error instanceof AiFailure) return failure(error)
    // Never echo unexpected error details to the client.
    console.error('[api/ai] unexpected error', error instanceof Error ? error.message : error)
    return failure(new AiFailure('upstream'))
  }
}

export function isAiErrorCode(value: unknown): value is AiErrorCode {
  return typeof value === 'string' && KNOWN_CODES.includes(value)
}

/** Real dependencies: reads the environment on every call so `.env.local` changes apply in dev. */
export function productionDeps(): AiHandlerDeps {
  return {
    env: {
      APP_SECRET: process.env.APP_SECRET,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
    },
    createCall: createAnthropicCall,
  }
}
