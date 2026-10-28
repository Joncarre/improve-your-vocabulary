import { describe, expect, it, vi } from 'vitest'
import { formatBytes, readStorageStatus, requestPersistence } from '../../src/lib/storage.ts'

function fakeStorage(overrides: Partial<Record<'persist' | 'persisted' | 'estimate', unknown>> = {}) {
  return {
    persist: vi.fn(async () => true),
    persisted: vi.fn(async () => false),
    estimate: vi.fn(async () => ({ usage: 2048, quota: 1_048_576 })),
    ...overrides,
  } as unknown as StorageManager
}

describe('requestPersistence', () => {
  it('is null when the Storage API does not exist', async () => {
    expect(await requestPersistence(undefined)).toBeNull()
  })

  it('does not ask again when the data is already persistent', async () => {
    const storage = fakeStorage({ persisted: vi.fn(async () => true) })
    expect(await requestPersistence(storage)).toBe(true)
    expect(storage.persist).not.toHaveBeenCalled()
  })

  it('asks the browser otherwise and returns its answer', async () => {
    expect(await requestPersistence(fakeStorage({ persist: vi.fn(async () => false) }))).toBe(false)
    expect(await requestPersistence(fakeStorage())).toBe(true)
  })

  it('treats a failing browser as not granted', async () => {
    const storage = fakeStorage({
      persisted: vi.fn(async () => {
        throw new Error('blocked')
      }),
    })
    expect(await requestPersistence(storage)).toBe(false)
  })
})

describe('readStorageStatus', () => {
  it('reports an unsupported browser', async () => {
    expect(await readStorageStatus(undefined)).toEqual({ supported: false, persisted: null })
  })

  it('combines persistence and the usage estimate', async () => {
    expect(await readStorageStatus(fakeStorage())).toEqual({
      supported: true,
      persisted: false,
      usage: 2048,
      quota: 1_048_576,
    })
  })
})

describe('formatBytes', () => {
  it.each([
    [512, '512 B'],
    [2048, '2.0 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
    [250 * 1024 * 1024, '250 MB'],
  ])('%d bytes -> %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
  })
})
