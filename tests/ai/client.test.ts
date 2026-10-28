import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiError, callAi, requestEnrich } from '../../src/ai/client.ts'
import { makeEnrichOutput } from '../factories.ts'

const meta = { model: 'claude-haiku-5-5', ms: 4000, inputTokens: 3500, outputTokens: 900 }
const okBody = { ok: true, mode: 'full', data: makeEnrichOutput(), meta }

function respond(status: number, body: unknown) {
  return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(body), { status }))
}

const base = { secret: 'my-secret', online: true }

afterEach(() => {
  vi.useRealTimers()
})

describe('requestEnrich', () => {
  it('posts the payload with the secret and returns the entry', async () => {
    const fetchImpl = respond(200, okBody)
    const entry = await requestEnrich({ input: 'went', context: 'We went home.' }, { ...base, fetchImpl })

    expect(entry.lemma).toBe('go')
    const [url, init] = fetchImpl.mock.calls[0] ?? []
    expect(url).toBe('/api/ai')
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('x-app-secret')).toBe('my-secret')
    expect(JSON.parse(String(init?.body))).toEqual({
      action: 'enrich',
      payload: { input: 'went', context: 'We went home.', mode: 'full' },
    })
  })
})

describe('failures', () => {
  const failure = async (promise: Promise<unknown>): Promise<AiError> => {
    const error = await promise.then(
      () => undefined,
      (caught: unknown) => caught,
    )
    expect(error).toBeInstanceOf(AiError)
    return error as AiError
  }

  it('asks for the secret instead of calling the server when it is missing', async () => {
    const fetchImpl = respond(200, okBody)
    const error = await failure(callAi({ input: 'go' }, { secret: '  ', fetchImpl }))

    expect(error).toMatchObject({ code: 'unauthorized', retryable: false })
    expect(error.message).toMatch(/Ajustes/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('does not even try without a connection', async () => {
    const fetchImpl = respond(200, okBody)
    const error = await failure(callAi({ input: 'go' }, { ...base, online: false, fetchImpl }))

    expect(error).toMatchObject({ code: 'network', retryable: true })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports a failed request as a network error that can be retried', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await failure(callAi({ input: 'go' }, { ...base, fetchImpl }))).toMatchObject({ code: 'network', retryable: true })
  })

  it.each([
    ['unauthorized', 401, false],
    ['rate_limited', 429, true],
    ['timeout', 504, true],
    ['invalid_output', 502, true],
    ['billing', 402, false],
    ['not_configured', 503, false],
    ['refused', 502, false],
  ])('keeps the code and message of a %s answer (retryable: %s)', async (code, status, retryable) => {
    const fetchImpl = respond(status, { ok: false, error: { code, message: `Mensaje ${code}` } })
    const error = await failure(callAi({ input: 'go' }, { ...base, fetchImpl }))

    expect(error).toMatchObject({ code, message: `Mensaje ${code}`, retryable })
  })

  it('reports a server error without our error format as upstream', async () => {
    const error = await failure(callAi({ input: 'go' }, { ...base, fetchImpl: respond(500, { whatever: 1 }) }))
    expect(error).toMatchObject({ code: 'upstream', retryable: true })
  })

  it('treats an answer that is not JSON as upstream', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>not an api</html>', { status: 200 }))
    expect((await failure(callAi({ input: 'go' }, { ...base, fetchImpl }))).code).toBe('invalid_output')
  })

  it('rejects an answer that does not match the contract', async () => {
    const fetchImpl = respond(200, { ok: true, mode: 'full', data: { lemma: 'go' }, meta })
    expect((await failure(callAi({ input: 'go' }, { ...base, fetchImpl }))).code).toBe('invalid_output')
  })

  it('gives up after 30 seconds', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const pending = failure(callAi({ input: 'go' }, { ...base, fetchImpl }))
    await vi.advanceTimersByTimeAsync(30_000)

    expect(await pending).toMatchObject({ code: 'timeout', retryable: true })
  })

  it('lets a cancellation by the caller through untouched', async () => {
    const controller = new AbortController()
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const pending = callAi({ input: 'go' }, { ...base, fetchImpl, signal: controller.signal })
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})
