import type { z } from 'zod'
import {
  AI_LIMITS,
  EnrichOutputSchema,
  ExamplesOnlyOutputSchema,
  normalizeEnrich,
  type EnrichPayload,
  type EnrichResponse,
} from '../../shared/index.js'
import { AiFailure, toAiFailure } from './errors.js'
import { buildEnrichUserMessage, buildExamplesUserMessage, ENRICH_SYSTEM, EXAMPLES_SYSTEM } from './prompts.js'

export interface StructuredRequest<T> {
  system: string
  user: string
  schema: z.ZodType<T>
  maxTokens: number
  signal: AbortSignal
}

export interface StructuredResult<T> {
  /** The parsed answer, or null when the model's text did not match the schema. */
  parsed: T | null
  stopReason: string | null
  inputTokens: number
  outputTokens: number
}

/** One structured-output call to the model. Injected so tests do not need the network. */
export type StructuredCall = <T>(request: StructuredRequest<T>) => Promise<StructuredResult<T>>

const MAX_TOKENS = 6_000
const MAX_ATTEMPTS = 2

export interface Structured<T> {
  data: T
  inputTokens: number
  outputTokens: number
}

/**
 * Calls the model and validates the answer with Zod, retrying once when it is incomplete or does
 * not match the schema. Refusals are final. Everything the SDK throws becomes an AiFailure.
 */
export async function runStructured<T>(
  call: StructuredCall,
  request: Omit<StructuredRequest<T>, 'maxTokens'>,
): Promise<Structured<T>> {
  let inputTokens = 0
  let outputTokens = 0
  let maxTokens = MAX_TOKENS

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let result: StructuredResult<T>
    try {
      result = await call({ ...request, maxTokens })
    } catch (error) {
      throw toAiFailure(error)
    }
    inputTokens += result.inputTokens
    outputTokens += result.outputTokens

    if (result.stopReason === 'refusal') throw new AiFailure('refused')

    if (result.parsed !== null) {
      const checked = request.schema.safeParse(result.parsed)
      if (checked.success) return { data: checked.data, inputTokens, outputTokens }
    }
    // Cut off by the token limit: the second attempt gets more room.
    if (result.stopReason === 'max_tokens') maxTokens = Math.round(maxTokens * 1.5)
  }
  throw new AiFailure('invalid_output')
}

export async function runAi(payload: EnrichPayload, call: StructuredCall, model: string): Promise<EnrichResponse> {
  const startedAt = Date.now()
  // One budget for the whole request, retries included.
  const signal = AbortSignal.timeout(AI_LIMITS.timeoutMs)
  const meta = (usage: { inputTokens: number; outputTokens: number }) => ({
    model,
    ms: Date.now() - startedAt,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  })

  if (payload.mode === 'examples_only') {
    const result = await runStructured(call, {
      system: EXAMPLES_SYSTEM,
      user: buildExamplesUserMessage(payload),
      schema: ExamplesOnlyOutputSchema,
      signal,
    })
    return { ok: true, mode: 'examples_only', data: result.data, meta: meta(result) }
  }

  const result = await runStructured(call, {
    system: ENRICH_SYSTEM,
    user: buildEnrichUserMessage(payload),
    schema: EnrichOutputSchema,
    signal,
  })
  return {
    ok: true,
    mode: 'full',
    data: normalizeEnrich(result.data, payload),
    meta: meta(result),
  }
}
