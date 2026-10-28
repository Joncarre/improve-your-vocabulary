import { describe, expect, it } from 'vitest'
import { secretsMatch } from '../../src/server/auth.ts'

describe('secretsMatch', () => {
  // A made-up value: tests must never contain the real APP_SECRET.
  const secret = 'unit-test-secret-AbCdEfGhIjKlMnOpQrStUvWxYz0123'

  it('accepts the exact secret', () => {
    expect(secretsMatch(secret, secret)).toBe(true)
  })

  it.each([
    ['a different secret of the same length', 'unit-test-secret-AbCdEfGhIjKlMnOpQrStUvWxYz0124'],
    ['a prefix of the secret', secret.slice(0, 10)],
    ['the secret with extra characters', `${secret}x`],
    ['an empty string', ''],
    ['different capitalisation', secret.toUpperCase()],
  ])('rejects %s', (_label, provided) => {
    expect(secretsMatch(provided, secret)).toBe(false)
  })

  it('rejects a missing header', () => {
    expect(secretsMatch(null, secret)).toBe(false)
  })
})
