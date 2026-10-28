import { describe, expect, it, vi } from 'vitest'
import type { StructuredCall, StructuredRequest } from '../../src/server/ai/enrich.ts'
import { AiFailure } from '../../src/server/ai/errors.ts'
import { handleAiRequest, type AiHandlerDeps } from '../../src/server/ai/handler.ts'
import { buildStoryUserMessage, STORY_SYSTEM } from '../../src/server/ai/prompts.ts'
import type { StoryOutput } from '../../src/shared/index.ts'

const SECRET = 'test-secret-value'

const TEXT = 'Tom gave up on the queue and went to the pub. He decided to order a pint. It was brilliant, and he left happy at last.'
const WORDS = [
  { lemma: 'give up', pos: 'phrasal_verb' },
  { lemma: 'queue', pos: 'noun' },
  { lemma: 'go', pos: 'verb' },
  { lemma: 'pint', pos: 'noun' },
  { lemma: 'brilliant', pos: 'adjective' },
  { lemma: 'leave', pos: 'verb' },
]

/** What a good answer looks like, with the positions wrong on purpose (models count badly). */
const good: StoryOutput = {
  title: 'A Pint at Last',
  textEn: TEXT,
  textEs: 'Tom se rindió con la cola…',
  targets: [
    { lemma: 'give up', surfaceForm: 'gave up', start: 40, end: 47 },
    { lemma: 'queue', surfaceForm: 'queue', start: 0, end: 5 },
    { lemma: 'go', surfaceForm: 'went', start: 3, end: 7 },
    { lemma: 'pint', surfaceForm: 'pint', start: 70, end: 74 },
    { lemma: 'brilliant', surfaceForm: 'brilliant', start: 1, end: 2 },
    { lemma: 'leave', surfaceForm: 'left', start: 0, end: 0 },
  ],
}

const answering = (...outputs: StoryOutput[]) => {
  const calls: StructuredRequest<unknown>[] = []
  const call: StructuredCall = async <T>(request: StructuredRequest<T>) => {
    calls.push(request as StructuredRequest<unknown>)
    const output = outputs[Math.min(calls.length - 1, outputs.length - 1)]
    return { parsed: request.schema.parse(output), stopReason: 'end_turn', inputTokens: 100, outputTokens: 50 }
  }
  return { call, calls }
}

function deps(call: StructuredCall): AiHandlerDeps {
  return { env: { APP_SECRET: SECRET, ANTHROPIC_API_KEY: 'sk-test' }, createCall: vi.fn(() => call) }
}

function story(payload: unknown, headers: Record<string, string> = { 'x-app-secret': SECRET }) {
  return new Request('http://localhost/api/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ action: 'story', payload }),
  })
}

async function errorOf(response: Response) {
  const body = (await response.json()) as { error: { code: string; message: string } }
  return { status: response.status, ...body.error }
}

describe('POST /api/ai: story', () => {
  it('writes the story and puts every word back where it really is', async () => {
    const { call, calls } = answering(good)
    const response = await handleAiRequest(story({ words: WORDS, level: 'B1' }), deps(call))
    const body = (await response.json()) as { ok: boolean; data: StoryOutput; meta: { model: string; inputTokens: number } }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.meta).toMatchObject({ model: 'claude-haiku-5-5', inputTokens: 100 })
    // In reading order, each one where it really is.
    expect(body.data.targets.map((item) => [item.lemma, body.data.textEn.slice(item.start, item.end)])).toEqual([
      ['give up', 'gave up'],
      ['queue', 'queue'],
      ['go', 'went'],
      ['pint', 'pint'],
      ['brilliant', 'brilliant'],
      ['leave', 'left'],
    ])
    expect(calls).toHaveLength(1)
  })

  it('sends the words, their types and the level to the model', async () => {
    const { call, calls } = answering(good)
    await handleAiRequest(story({ words: WORDS, level: 'B2' }), deps(call))
    expect(calls[0]?.system).toBe(STORY_SYSTEM)
    expect(calls[0]?.user).toContain('CEFR level: B2')
    expect(calls[0]?.user).toContain('1. "give up" (phrasal_verb)')
    expect(calls[0]?.user).toBe(buildStoryUserMessage({ words: WORDS as never, level: 'B2' }))
  })

  it('asks the prompt of the spec: British, 100 to 150 words, all the words, humour', () => {
    expect(STORY_SYSTEM).toMatch(/British English/)
    expect(STORY_SYSTEM).toMatch(/100 to 150 words/)
    expect(STORY_SYSTEM).toMatch(/ALL the given words/)
    expect(STORY_SYSTEM).toMatch(/humour/)
  })

  it('asks once more when too many of the words are not in the text, and adds up what it spent', async () => {
    const bad: StoryOutput = { ...good, targets: good.targets.map((item) => ({ ...item, surfaceForm: `${item.surfaceForm}zzz` })).slice(0, 5) }
    const { call, calls } = answering(bad, good)
    const response = await handleAiRequest(story({ words: WORDS }), deps(call))
    const body = (await response.json()) as { meta: { inputTokens: number; outputTokens: number }; data: StoryOutput }

    expect(response.status).toBe(200)
    expect(calls).toHaveLength(2)
    expect(body.meta).toMatchObject({ inputTokens: 200, outputTokens: 100 })
    expect(body.data.targets).toHaveLength(6)
  })

  it('gives up with a clear error when the second story is no better', async () => {
    const bad: StoryOutput = { ...good, targets: [{ lemma: 'go', surfaceForm: 'flew', start: 0, end: 4 }] }
    const { call, calls } = answering(bad)
    expect(await errorOf(await handleAiRequest(story({ words: WORDS }), deps(call)))).toMatchObject({ status: 502, code: 'invalid_output' })
    expect(calls).toHaveLength(2)
  })

  it('accepts a story that misses one word of six, but not two', async () => {
    const missing = (count: number): StoryOutput => ({ ...good, targets: good.targets.slice(0, 6 - count) })
    expect((await handleAiRequest(story({ words: WORDS }), deps(answering(missing(1)).call))).status).toBe(200)
    expect((await handleAiRequest(story({ words: WORDS }), deps(answering(missing(2)).call))).status).toBe(502)
  })

  it('passes the failures of the model on with their status', async () => {
    const failing: StructuredCall = async () => {
      throw new AiFailure('rate_limited')
    }
    expect(await errorOf(await handleAiRequest(story({ words: WORDS }), deps(failing)))).toMatchObject({ status: 429, code: 'rate_limited' })
  })
})

describe('POST /api/ai: story, access and validation', () => {
  it('needs the secret and never calls the model without it', async () => {
    const { call, calls } = answering(good)
    expect(await errorOf(await handleAiRequest(story({ words: WORDS }, { 'x-app-secret': 'nope' }), deps(call)))).toMatchObject({ status: 401, code: 'unauthorized' })
    expect(calls).toHaveLength(0)
  })

  it.each([
    ['no words', { words: [] }, /entre 1 y 10/],
    ['more than ten words', { words: Array.from({ length: 11 }, (_, i) => ({ lemma: `w${i}`, pos: 'noun' })) }, /entre 1 y 10/],
    ['a word over 80 characters', { words: [{ lemma: 'x'.repeat(81), pos: 'noun' }] }, /80 caracteres/],
    ['a level that does not exist', { words: WORDS, level: 'D1' }, /A1, A2, B1/],
    ['words missing', {}, /entre 1 y 10/],
  ])('rejects %s with a message in Spanish, and does not call the model', async (_label, payload, message) => {
    const { call, calls } = answering(good)
    const error = await errorOf(await handleAiRequest(story(payload), deps(call)))
    expect(error).toMatchObject({ status: 400, code: 'bad_request' })
    expect(error.message).toMatch(message)
    expect(calls).toHaveLength(0)
  })
})
