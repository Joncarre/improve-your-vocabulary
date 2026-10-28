import Anthropic from '@anthropic-ai/sdk'
import type { AiErrorCode } from '../../shared/index.js'

const STATUS: Record<AiErrorCode, number> = {
  unauthorized: 401,
  bad_request: 400,
  not_configured: 503,
  server_misconfigured: 500,
  rate_limited: 429,
  billing: 402,
  timeout: 504,
  refused: 502,
  invalid_output: 502,
  upstream: 502,
  method_not_allowed: 405,
  not_implemented: 501,
}

/** User-facing messages (Spanish: they are shown in the interface as they are). */
const MESSAGE: Record<AiErrorCode, string> = {
  unauthorized: 'Secreto incorrecto o ausente. Revísalo en Ajustes.',
  bad_request: 'La petición no es válida.',
  not_configured: 'La IA no está configurada en el servidor.',
  server_misconfigured: 'El servidor no está bien configurado: revisa las variables de entorno.',
  rate_limited: 'La IA está saturada ahora mismo. Inténtalo de nuevo en un momento.',
  billing: 'La cuenta de Anthropic se ha quedado sin saldo.',
  timeout: 'La IA ha tardado demasiado en responder.',
  refused: 'La IA no ha podido completar esta entrada.',
  invalid_output: 'La IA ha devuelto una respuesta incompleta. Inténtalo de nuevo.',
  upstream: 'No se ha podido contactar con la IA. Inténtalo de nuevo.',
  method_not_allowed: 'Método no permitido.',
  not_implemented: 'Esta acción todavía no está disponible.',
}

export class AiFailure extends Error {
  readonly code: AiErrorCode
  readonly status: number

  constructor(code: AiErrorCode, message?: string) {
    super(message ?? MESSAGE[code])
    this.name = 'AiFailure'
    this.code = code
    this.status = STATUS[code]
  }
}

/** Translates whatever the SDK (or a timeout) threw into an {@link AiFailure}. */
export function toAiFailure(error: unknown): AiFailure {
  if (error instanceof AiFailure) return error
  if (
    error instanceof Anthropic.APIUserAbortError ||
    error instanceof Anthropic.APIConnectionTimeoutError ||
    (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'))
  ) {
    return new AiFailure('timeout')
  }
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AiFailure('server_misconfigured', 'La clave de la API de Anthropic del servidor no es válida.')
  }
  if (error instanceof Anthropic.RateLimitError) return new AiFailure('rate_limited')
  if (error instanceof Anthropic.BadRequestError && /credit balance|billing|too low/i.test(error.message)) {
    return new AiFailure('billing')
  }
  return new AiFailure('upstream')
}
