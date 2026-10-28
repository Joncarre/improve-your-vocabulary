import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it, vi } from 'vitest'
import { runAi, type StructuredCall, type StructuredRequest, type StructuredResult } from '../../src/server/ai/enrich.ts'
import { AiFailure, toAiFailure } from '../../src/server/ai/errors.ts'
import { EnrichPayloadSchema, ExamplesOnlyOutputSchema } from '../../src/shared/index.ts'
import { makeEnrichOutput } from '../factories.ts'

const payload = EnrichPayloadSchema.parse({ input: 'went', context: 'We went to the pub after work.' })

/** A model that answers with `answers[n]` on the n-th call (the last one repeats). */
function scripted(answers: Array<Partial<StructuredResult<unknown>> | Error>): {
  call: StructuredCall
  requests: StructuredRequest<unknown>[]
} {
  const requests: StructuredRequest<unknown>[] = []
  const call: StructuredCall = async <T>(request: StructuredRequest<T>) => {
    requests.push(request as StructuredRequest<unknown>)
    const answer = answers[Math.min(requests.length - 1, answers.length - 1)]
    if (answer instanceof Error) throw answer
    return {
      parsed: null,
      stopReason: 'end_turn',
      inputTokens: 100,
      outputTokens: 50,
      ...answer,
    } as StructuredResult<T>
  }
  return { call, requests }
}

describe('runAi (enrich)', () => {
  it('returns the validated, normalised answer with usage', async () => {
    const { call, requests } = scripted([{ parsed: makeEnrichOutput({ synonyms: [' travel ', 'travel', 'move'] }) }])
    const result = await runAi(payload, call, 'claude-haiku-5-5')

    expect(result).toMatchObject({ ok: true, mode: 'full', meta: { model: 'claude-haiku-5-5', inputTokens: 100, outputTokens: 50 } })
    if (result.mode !== 'full') throw new Error('unexpected mode')
    expect(result.data.synonyms).toEqual(['travel', 'move'])
    expect(requests).toHaveLength(1)
    expect(requests[0]?.system).toContain('lexicographer of British English')
    expect(requests[0]?.user).toContain('We went to the pub after work.')
  })

  it('retries once when the answer does not match the schema, adding up the tokens', async () => {
    const { call, requests } = scripted([{ parsed: null }, { parsed: makeEnrichOutput() }])
    const result = await runAi(payload, call, 'm')

    expect(requests).toHaveLength(2)
    expect(result.meta).toMatchObject({ inputTokens: 200, outputTokens: 100 })
  })

  it('gives up with invalid_output after the retry', async () => {
    const { call, requests } = scripted([{ parsed: null }])
    await expect(runAi(payload, call, 'm')).rejects.toMatchObject({ code: 'invalid_output', status: 502 })
    expect(requests).toHaveLength(2)
  })

  it('treats a refusal as final, without retrying', async () => {
    const { call, requests } = scripted([{ parsed: null, stopReason: 'refusal' }])
    await expect(runAi(payload, call, 'm')).rejects.toMatchObject({ code: 'refused' })
    expect(requests).toHaveLength(1)
  })

  it('gives the retry more room after being cut off by max_tokens', async () => {
    const { call, requests } = scripted([{ parsed: null, stopReason: 'max_tokens' }, { parsed: makeEnrichOutput() }])
    await runAi(payload, call, 'm')

    expect(requests.map((request) => request.maxTokens)).toEqual([6000, 9000])
  })

  it('shares one 25 s budget across attempts through the abort signal', async () => {
    const { call, requests } = scripted([{ parsed: makeEnrichOutput() }])
    await runAi(payload, call, 'm')

    expect(requests[0]?.signal).toBeInstanceOf(AbortSignal)
  })
})

describe('runAi (examples_only)', () => {
  it('uses the examples prompt and schema', async () => {
    const examplesPayload = EnrichPayloadSchema.parse({
      input: 'go',
      mode: 'examples_only',
      senses: [{ pos: 'verb', meaningEs: 'ir' }],
    })
    const { call, requests } = scripted([
      { parsed: { senses: [{ examples: [{ en: 'We go home.', es: 'Vamos a casa.', target: 'go' }] }] } },
    ])
    const result = await runAi(examplesPayload, call, 'm')

    expect(result.mode).toBe('examples_only')
    expect(requests[0]?.system).toContain('example sentences')
    expect(requests[0]?.user).toContain('1. verb: ir')
    expect(requests[0]?.schema).toBe(ExamplesOnlyOutputSchema)
  })
})

describe('toAiFailure', () => {
  const headers = new Headers()
  const sdkError = (status: number, message: string) =>
    Anthropic.APIError.generate(status, { type: 'error', error: { type: 'x', message } }, message, headers)

  it.each([
    ['rate limit', sdkError(429, 'slow down'), 'rate_limited'],
    ['out of credit', sdkError(400, 'Your credit balance is too low to access the API'), 'billing'],
    ['a bad key', sdkError(401, 'invalid x-api-key'), 'server_misconfigured'],
    ['a server error', sdkError(500, 'oops'), 'upstream'],
    ['an unrelated bad request', sdkError(400, 'messages: field required'), 'upstream'],
    ['a user abort', new Anthropic.APIUserAbortError(), 'timeout'],
    ['a connection timeout', new Anthropic.APIConnectionTimeoutError(), 'timeout'],
    ['a platform timeout signal', new DOMException('The operation timed out.', 'TimeoutError'), 'timeout'],
    ['anything else', new Error('boom'), 'upstream'],
  ])('maps %s to %s', (_label, error, code) => {
    expect(toAiFailure(error).code).toBe(code)
  })

  it('keeps an AiFailure as it is', () => {
    const failure = new AiFailure('refused')
    expect(toAiFailure(failure)).toBe(failure)
  })

  it('never leaks the SDK message of an upstream failure', () => {
    expect(toAiFailure(sdkError(500, 'internal secret detail')).message).not.toContain('secret detail')
  })
})

describe('error plumbing', () => {
  it('turns a thrown SDK error into an AiFailure with the right status', async () => {
    const { call } = scripted([Anthropic.APIError.generate(429, {}, 'x', new Headers())])
    const spy = vi.fn()
    await runAi(payload, call, 'm').catch(spy)

    expect(spy).toHaveBeenCalledOnce()
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ code: 'rate_limited', status: 429 })
  })
})
