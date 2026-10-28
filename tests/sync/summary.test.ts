import { describe, expect, it } from 'vitest'
import { formatAgo, isSyncStale, STALE_AFTER_MS, summarizeSync, type SyncSummaryInput } from '../../src/sync/summary.ts'

const base: SyncSummaryInput = { hasSecret: true, running: false, online: true, error: null, pending: 0 }
const kind = (patch: Partial<SyncSummaryInput>) => summarizeSync({ ...base, ...patch }).kind

describe('summarizeSync', () => {
  it('is synced when nothing waits and nothing failed', () => {
    expect(summarizeSync(base)).toEqual({ kind: 'synced', label: 'Sincronizado' })
  })

  it('is pending when records wait to be uploaded', () => {
    expect(kind({ pending: 3 })).toBe('pending')
  })

  it('is syncing while a run is going, even with pending records', () => {
    expect(kind({ running: true, pending: 3 })).toBe('syncing')
  })

  it('is offline without a connection, or when the last failure was the connection', () => {
    expect(kind({ online: false, pending: 2 })).toBe('offline')
    expect(kind({ error: { code: 'network', message: '' } })).toBe('offline')
    expect(kind({ error: { code: 'timeout', message: '' } })).toBe('offline')
  })

  it('shows other failures as an error', () => {
    expect(kind({ error: { code: 'unauthorized', message: '' } })).toBe('error')
    expect(kind({ error: { code: 'database', message: '' }, pending: 4 })).toBe('error')
  })

  it('is off until the secret is entered', () => {
    expect(kind({ hasSecret: false, error: { code: 'unauthorized', message: '' }, pending: 2 })).toBe('off')
  })
})

describe('isSyncStale', () => {
  const now = 100 * 24 * 60 * 60 * 1000

  it('is false within a week of the last successful sync', () => {
    expect(isSyncStale({ lastOkAt: now - STALE_AFTER_MS + 1, oldestEntryAt: undefined, now })).toBe(false)
  })

  it('is true after more than a week', () => {
    expect(isSyncStale({ lastOkAt: now - STALE_AFTER_MS - 1, oldestEntryAt: undefined, now })).toBe(true)
  })

  it('counts from the oldest word for a device that never synced', () => {
    expect(isSyncStale({ lastOkAt: undefined, oldestEntryAt: now - 8 * 24 * 60 * 60 * 1000, now })).toBe(true)
    expect(isSyncStale({ lastOkAt: undefined, oldestEntryAt: now - 2 * 24 * 60 * 60 * 1000, now })).toBe(false)
  })

  it('is false for an empty device that never synced', () => {
    expect(isSyncStale({ lastOkAt: undefined, oldestEntryAt: undefined, now })).toBe(false)
  })
})

describe('formatAgo', () => {
  const now = 10_000_000_000
  it.each([
    [30_000, 'ahora mismo'],
    [5 * 60_000, 'hace 5 min'],
    [3 * 3_600_000, 'hace 3 h'],
    [24 * 3_600_000, 'hace 1 día'],
    [4 * 24 * 3_600_000, 'hace 4 días'],
  ])('%i ms ago is "%s"', (elapsed, text) => {
    expect(formatAgo(now - elapsed, now)).toBe(text)
  })
})
