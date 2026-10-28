import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../src/db/db.ts'
import { writeRecord } from '../../src/db/repo.ts'
import { loadDeviceSettings, saveDeviceSettings } from '../../src/db/settings.ts'
import { handleSyncRequest } from '../../src/server/sync/handler.ts'
import { createMemoryStore } from '../../src/server/sync/memoryStore.ts'
import { isSyncing, requestSync } from '../../src/sync/scheduler.ts'
import { getSyncStatus, setSyncStatus } from '../../src/sync/status.ts'
import { makeTopic } from '../factories.ts'

const SECRET = 'test-secret-value'

function serverFetch(delayMs = 0) {
  const store = createMemoryStore()
  const calls = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs))
    return handleSyncRequest(new Request('http://localhost/api/sync', init), {
      env: { APP_SECRET: SECRET, DATABASE_URL: 'postgres://test' },
      createStore: () => store,
    })
  })
  return { store, calls, fetchImpl: calls as unknown as typeof fetch }
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  await saveDeviceSettings({ appSecret: SECRET })
  setSyncStatus({ running: false, error: null, warning: null })
})

describe('requestSync', () => {
  it('runs one synchronisation and reports success', async () => {
    const { store, fetchImpl } = serverFetch()
    await writeRecord('topics', makeTopic())
    await requestSync({ fetchImpl })
    expect(store.rows.size).toBe(1)
    expect(getSyncStatus()).toEqual({ running: false, error: null, warning: null })
    expect(isSyncing()).toBe(false)
  })

  it('never runs two at once: a request made meanwhile goes round once more', async () => {
    const { calls, fetchImpl } = serverFetch(10)
    await writeRecord('topics', makeTopic())

    const first = requestSync({ fetchImpl })
    const second = requestSync({ fetchImpl })
    const third = requestSync({ fetchImpl })
    expect(isSyncing()).toBe(true)
    await Promise.all([first, second, third])

    // First run: push + pull. The requests made during it count as one more run: pull only.
    const actions = calls.mock.calls.map(([, init]) => (JSON.parse(String(init?.body)) as { action: string }).action)
    expect(actions).toEqual(['push', 'pull', 'pull'])
  })

  it('does nothing without the secret', async () => {
    const { calls, fetchImpl } = serverFetch()
    await saveDeviceSettings({ appSecret: '' })
    await requestSync({ fetchImpl })
    expect(calls).not.toHaveBeenCalled()
  })

  it('shows a failure, keeps the data, and records the attempt', async () => {
    await writeRecord('topics', makeTopic())
    const offline = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    await requestSync({ fetchImpl: offline as unknown as typeof fetch })

    expect(getSyncStatus().error).toMatchObject({ code: 'network' })
    expect(getSyncStatus().running).toBe(false)
    expect(await db.outbox.count()).toBe(1)
    const settings = await loadDeviceSettings()
    expect(settings.lastSyncAt).toBeDefined()
    expect(settings.lastSyncOkAt).toBeUndefined()
  })

  it('clears the failure when the next run works', async () => {
    const { fetchImpl } = serverFetch()
    setSyncStatus({ error: { code: 'network', message: 'Sin conexión.' } })
    await requestSync({ fetchImpl })
    expect(getSyncStatus().error).toBeNull()
    expect((await loadDeviceSettings()).lastSyncOkAt).toBeDefined()
  })

  it('warns when the server refused some records', async () => {
    const { fetchImpl } = serverFetch()
    await writeRecord('topics', makeTopic({ nameEs: '' }))
    await requestSync({ fetchImpl })
    expect(getSyncStatus().warning).toBe('Un registro no se ha podido sincronizar.')
  })
})
