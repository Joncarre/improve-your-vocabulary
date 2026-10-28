import {
  AI_LIMITS,
  normalizeStory,
  StoryOutputSchema,
  storyTargetsNeeded,
  type StoryPayload,
  type StoryResponse,
} from '../../shared/index.js'
import { runStructured, type StructuredCall } from './enrich.js'
import { AiFailure } from './errors.js'
import { buildStoryUserMessage, STORY_SYSTEM } from './prompts.js'

const MAX_ATTEMPTS = 2

/**
 * Asks for a story and puts its words back in place (risk R12). A story in which too many of the words cannot
 * be found in the text is no use for the gaps game, so it is asked for once more before giving up.
 */
export async function runStory(payload: StoryPayload, call: StructuredCall, model: string): Promise<StoryResponse> {
  const startedAt = Date.now()
  // One budget for the whole request, retries included.
  const signal = AbortSignal.timeout(AI_LIMITS.timeoutMs)
  const needed = storyTargetsNeeded(payload.words.length)
  let inputTokens = 0
  let outputTokens = 0

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const result = await runStructured(call, {
      system: STORY_SYSTEM,
      user: buildStoryUserMessage(payload),
      schema: StoryOutputSchema,
      signal,
    })
    inputTokens += result.inputTokens
    outputTokens += result.outputTokens

    const data = normalizeStory(result.data, payload.words)
    if (data.textEn && data.targets.length >= needed) {
      return { ok: true, data, meta: { model, ms: Date.now() - startedAt, inputTokens, outputTokens } }
    }
  }
  throw new AiFailure('invalid_output')
}
