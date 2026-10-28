import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { StructuredCall } from './enrich.js'

/**
 * The real model call. `effort: 'low'` keeps Haiku 5.5 from spending time (and tokens) thinking on
 * what is a lookup task; no temperature or prefill, which that model rejects.
 */
export function createAnthropicCall(apiKey: string, model: string): StructuredCall {
  const client = new Anthropic({ apiKey, maxRetries: 1 })

  return async (request) => {
    const response = await client.messages.parse(
      {
        model,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: [{ role: 'user', content: request.user }],
        thinking: { type: 'disabled' },
        output_config: { effort: 'low', format: zodOutputFormat(request.schema) },
      },
      { signal: request.signal },
    )
    return {
      parsed: response.parsed_output,
      stopReason: response.stop_reason,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }
  }
}
