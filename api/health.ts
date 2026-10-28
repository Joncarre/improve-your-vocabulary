import { HealthResponseSchema } from '../src/shared/health.js'

export default {
  fetch(): Response {
    const body = HealthResponseSchema.parse({
      ok: true,
      service: 'improve-your-vocabulary',
      time: Date.now(),
    })
    return Response.json(body, { headers: { 'Cache-Control': 'no-store' } })
  },
}
