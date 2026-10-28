import { describe, expect, it, vi } from 'vitest'
import { AiFailure } from '../../src/server/ai/errors.ts'
import { handleAiRequest, type AiEnv, type AiHandlerDeps } from '../../src/server/ai/handler.ts'
import type { StructuredCall, StructuredRequest } from '../../src/server/ai/enrich.ts'
import { AI_LIMITS } from '../../src/shared/index.ts'
import { makeEnrichOutput } from '../factories.ts'

const SECRET = 'test-secret-value'

/** A model that always answers with a good "went" entry. */
const goodCall: StructuredCall = async <T>(request: StructuredRequest<T>) => ({
  parsed: request.schema.parse(makeEnrichOutput()),
  stopReason: 'end_turn',
  inputTokens: 10,
  outputTokens: 20,
})

function deps(overrides: { env?: Partial<AiEnv>; call?: StructuredCall } = {}) {
  const createCall = vi.fn((_apiKey: string, _model: string) => overrides.call ?? goodCall)
  const value: AiHandlerDeps = {
    env: { APP_SECRET: SECRET, ANTHROPIC_API_KEY: 'sk-test', ...overrides.env },
    createCall,
  }
  return { value, createCall }
}

function post(body: unknown, headers: Record<string, string> = { 'x-app-secret': SECRET }) {
  return new Request('http://localhost/api/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const enrich = (payload: Record<string, unknown>) => ({ action: 'enrich', payload })

async function errorOf(response: Response) {
  const body = (await response.json()) as { ok: boolean; error: { code: string; message: string } }
  return { status: response.status, ...body.error }
}

describe('POST /api/ai: access', () => {
  it('only accepts POST', async () => {
    const response = await handleAiRequest(new Request('http://localhost/api/ai'), deps().value)
    expect(await errorOf(response)).toMatchObject({ status: 405, code: 'method_not_allowed' })
  })

  it('answers 500 when the server has no APP_SECRET', async () => {
    const response = await handleAiRequest(post(enrich({ input: 'go' })), deps({ env: { APP_SECRET: undefined } }).value)
    expect(await errorOf(response)).toMatchObject({ status: 500, code: 'server_misconfigured' })
  })

  it.each([
    ['a wrong secret', { 'x-app-secret': 'nope' }],
    ['no secret header', {}],
  ])('answers 401 with %s and never calls the model', async (_label, headers) => {
    const { value, createCall } = deps()
    const response = await handleAiRequest(post(enrich({ input: 'go' }), headers), value)

    expect(await errorOf(response)).toMatchObject({ status: 401, code: 'unauthorized' })
    expect(createCall).not.toHaveBeenCalled()
  })

  it('checks the secret before looking at the body', async () => {
    const response = await handleAiRequest(post('not json', { 'x-app-secret': 'nope' }), deps().value)
    expect((await errorOf(response)).code).toBe('unauthorized')
  })

  it('answers 503 when there is no Anthropic key (the app then works without AI)', async () => {
    const response = await handleAiRequest(post(enrich({ input: 'go' })), deps({ env: { ANTHROPIC_API_KEY: undefined } }).value)
    expect(await errorOf(response)).toMatchObject({ status: 503, code: 'not_configured' })
  })
})

describe('POST /api/ai: validation', () => {
  it.each([
    ['a word over 80 characters', enrich({ input: 'x'.repeat(AI_LIMITS.wordMax + 1) }), /80 caracteres/],
    ['an empty word', enrich({ input: '   ' }), /obligatoria/],
    ['a sentence over 400 characters', enrich({ input: 'go', context: 'x'.repeat(AI_LIMITS.sentenceMax + 1) }), /400 caracteres/],
    [
      'more than 50 topics',
      enrich({ input: 'go', existingTopics: Array.from({ length: 51 }, (_, i) => ({ id: `t${i}`, nameEs: `Tema ${i}` })) }),
      /50 elementos/,
    ],
  ])('rejects %s with a clear Spanish message', async (_label, body, message) => {
    const response = await handleAiRequest(post(body), deps().value)
    const error = await errorOf(response)

    expect(error).toMatchObject({ status: 400, code: 'bad_request' })
    expect(error.message).toMatch(message)
  })

  it('accepts a word of exactly 80 characters', async () => {
    const response = await handleAiRequest(post(enrich({ input: 'x'.repeat(AI_LIMITS.wordMax) })), deps().value)
    expect(response.status).toBe(200)
  })

  it('rejects a body that is not JSON', async () => {
    const response = await handleAiRequest(post('{nope'), deps().value)
    expect(await errorOf(response)).toMatchObject({ status: 400, code: 'bad_request' })
  })

  it('rejects an oversized body', async () => {
    const response = await handleAiRequest(post(enrich({ input: 'go', context: 'x'.repeat(30_000) })), deps().value)
    expect((await errorOf(response)).message).toMatch(/demasiado grande/)
  })

  it('rejects an unknown action and answers 501 for story (phase 8)', async () => {
    expect((await errorOf(await handleAiRequest(post({ action: 'translate', payload: {} }), deps().value))).code).toBe('bad_request')
    expect(await errorOf(await handleAiRequest(post({ action: 'story', payload: {} }), deps().value))).toMatchObject({
      status: 501,
      code: 'not_implemented',
    })
  })
})

describe('POST /api/ai: enrich', () => {
  it('returns the entry with usage metadata', async () => {
    const response = await handleAiRequest(
      post(enrich({ input: 'went', context: 'We went to the pub after work.' })),
      deps().value,
    )
    const body = (await response.json()) as { ok: boolean; mode: string; data: { lemma: string }; meta: { model: string } }

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body).toMatchObject({ ok: true, mode: 'full', data: { lemma: 'go' }, meta: { model: 'claude-haiku-5-5' } })
  })

  it('uses ANTHROPIC_MODEL when set and the default otherwise', async () => {
    const custom = deps({ env: { ANTHROPIC_MODEL: 'claude-sonnet-5-5' } })
    await handleAiRequest(post(enrich({ input: 'go' })), custom.value)
    expect(custom.createCall).toHaveBeenCalledWith('sk-test', 'claude-sonnet-5-5')

    const fallback = deps()
    await handleAiRequest(post(enrich({ input: 'go' })), fallback.value)
    expect(fallback.createCall).toHaveBeenCalledWith('sk-test', 'claude-haiku-5-5')
  })

  it('passes model failures on with their status and Spanish message', async () => {
    const failing: StructuredCall = async () => {
      throw new AiFailure('rate_limited')
    }
    const response = await handleAiRequest(post(enrich({ input: 'go' })), deps({ call: failing }).value)
    expect(await errorOf(response)).toMatchObject({ status: 429, code: 'rate_limited' })
  })

  it('hides unexpected errors behind a generic message', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failing: StructuredCall = async () => {
      throw new Error('database password is hunter2')
    }
    const response = await handleAiRequest(post(enrich({ input: 'go' })), deps({ call: failing }).value)
    const error = await errorOf(response)

    expect(error).toMatchObject({ status: 502, code: 'upstream' })
    expect(JSON.stringify(error)).not.toContain('hunter2')
    consoleError.mockRestore()
  })
})
