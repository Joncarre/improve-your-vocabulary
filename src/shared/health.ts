import { z } from 'zod'

/** Response of GET /api/health (also proves api/ can import code shared with the app). */
export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal('improve-your-vocabulary'),
  time: z.number().int().nonnegative(),
})
export type HealthResponse = z.infer<typeof HealthResponseSchema>
