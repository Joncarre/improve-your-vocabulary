import { describe, expect, it } from 'vitest'
import health from '../../api/health.ts'
import { HealthResponseSchema } from '../../src/shared/index.ts'

describe('GET /api/health', () => {
  it('answers with a body that matches the schema shared with the app', async () => {
    const response = await health.fetch()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(HealthResponseSchema.safeParse(await response.json()).success).toBe(true)
  })
})
