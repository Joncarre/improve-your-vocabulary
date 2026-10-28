import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Constant-time comparison of the `x-app-secret` header with APP_SECRET. Both values are hashed
 * first so the comparison always runs over 32 bytes, whatever the length of the input.
 */
export function secretsMatch(provided: string | null, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest()
  const equal = timingSafeEqual(digest(provided ?? ''), digest(expected))
  return provided !== null && equal
}
