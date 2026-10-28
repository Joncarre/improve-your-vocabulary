import { describe, expect, it, vi } from 'vitest'
import { handleSyncRequest, type SyncEnv, type SyncHandlerDeps } from '../../src/server/sync/handler.ts'
import { createMemoryStore } from '../../src/server/sync/memoryStore.ts'
import type { RecordStore } from '../../src/server/sync/store.ts'
import { SYNC_LIMITS, type PullResponse, type PushResponse } from '../../src/shared/index.ts'
import { makeCard, makeEntry, makeTopic } from '../factories.ts'

const SECRET = 'test-secret-value'

function setup(env: Partial<SyncEnv> = {}, store: RecordStore = createMemoryStore()) {
  const createStore = vi.fn((_url: string, _table?: string) => store)
  const deps: SyncHandlerDeps = { env: { APP_SECRET: SECRET, DATABASE_URL: 'postgres://test', ...env }, createStore }
  return { deps, createStore, store }
}

function post(body: unknown, headers: Record<string, string> = { 'x-app-secret': SECRET }) {
  return new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function errorOf(response: Response) {
  const body = (await response.json()) as { ok: boolean; error: { code: string } }
  return { status: response.status, ok: body.ok, code: body.error.code }
}

const push = (records: { table: string; data: unknown }[]) => ({ action: 'push', records })
const pull = (cursor: number, limit?: number) => ({ action: 'pull', cursor, ...(limit ? { limit } : {}) })

describe('POST /api/sync: access', () => {
  it('only accepts POST', async () => {
    const { deps } = setup()
    expect(await errorOf(await handleSyncRequest(new Request('http://localhost/api/sync'), deps))).toMatchObject({ status: 405, code: 'method_not_allowed' })
  })

  it('answers 500 when the server has no APP_SECRET', async () => {
    const { deps } = setup({ APP_SECRET: undefined })
    expect(await errorOf(await handleSyncRequest(post(pull(0)), deps))).toMatchObject({ status: 500, code: 'server_misconfigured' })
  })

  it.each([
    ['a wrong secret', { 'x-app-secret': 'nope' }],
    ['no secret', {}],
  ])('answers 401 with %s and never touches the database', async (_label, headers) => {
    const { deps, createStore } = setup()
    expect(await errorOf(await handleSyncRequest(post(pull(0), headers), deps))).toMatchObject({ status: 401, code: 'unauthorized' })
    expect(createStore).not.toHaveBeenCalled()
  })

  it('answers 503 when there is no database yet', async () => {
    const { deps } = setup({ DATABASE_URL: undefined })
    expect(await errorOf(await handleSyncRequest(post(pull(0)), deps))).toMatchObject({ status: 503, code: 'not_configured' })
  })

  it('passes the optional table name to the store (tests only)', async () => {
    const { deps, createStore } = setup({ SYNC_TABLE: 'records_test' })
    await handleSyncRequest(post(pull(0)), deps)
    expect(createStore).toHaveBeenCalledWith('postgres://test', 'records_test')
  })
})

describe('POST /api/sync: bad requests', () => {
  it('rejects a body that is not JSON', async () => {
    const { deps } = setup()
    expect(await errorOf(await handleSyncRequest(post('{nope'), deps))).toMatchObject({ status: 400, code: 'bad_request' })
  })

  it.each([
    ['an unknown action', { action: 'delete' }],
    ['a negative cursor', pull(-1)],
    ['a page bigger than the maximum', pull(0, SYNC_LIMITS.pullRecords + 1)],
    ['too many records in a push', push(Array.from({ length: SYNC_LIMITS.pushRecords + 1 }, () => ({ table: 'topics', data: {} })))],
    ['an unknown table', push([{ table: 'deviceSettings', data: {} }])],
  ])('rejects %s', async (_label, body) => {
    const { deps } = setup()
    expect(await errorOf(await handleSyncRequest(post(body), deps))).toMatchObject({ status: 400, code: 'bad_request' })
  })

  it('rejects a body over the limit', async () => {
    const { deps } = setup()
    const huge = JSON.stringify({ action: 'pull', cursor: 0, pad: 'x'.repeat(SYNC_LIMITS.bodyBytes) })
    expect(await errorOf(await handleSyncRequest(post(huge), deps))).toMatchObject({ status: 413, code: 'payload_too_large' })
  })

  it('answers with a database error and does not leak the details', async () => {
    const broken: RecordStore = {
      ensureSchema: () => Promise.reject(new Error('connection to host db.secret.internal failed')),
      upsert: () => Promise.resolve(0),
      pull: () => Promise.resolve({ rows: [], latest: 0 }),
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const response = await handleSyncRequest(post(pull(0)), setup({}, broken).deps)
    const text = await response.text()
    spy.mockRestore()
    expect(response.status).toBe(502)
    expect(text).toContain('database')
    expect(text).not.toContain('secret.internal')
  })
})

describe('POST /api/sync: push and pull', () => {
  it('stores pushed records and returns them from a pull, with the cursor', async () => {
    const { deps } = setup()
    const entry = makeEntry({ updatedAt: 100 })
    const card = makeCard({ entryId: entry.id, updatedAt: 100 })

    const pushed = (await (await handleSyncRequest(post(push([{ table: 'entries', data: entry }, { table: 'cards', data: card }])), deps)).json()) as PushResponse
    expect(pushed).toEqual({ ok: true, action: 'push', applied: 2, rejected: [] })

    const pulled = (await (await handleSyncRequest(post(pull(0)), deps)).json()) as PullResponse
    expect(pulled.records).toEqual([
      { table: 'entries', data: entry },
      { table: 'cards', data: card },
    ])
    expect(pulled).toMatchObject({ cursor: 2, latest: 2, hasMore: false })
  })

  it('creates the schema once per store, not on every request', async () => {
    const store = createMemoryStore()
    const ensure = vi.spyOn(store, 'ensureSchema')
    const { deps } = setup({}, store)
    await handleSyncRequest(post(pull(0)), deps)
    await handleSyncRequest(post(pull(0)), deps)
    expect(ensure).toHaveBeenCalledTimes(1)
  })

  it('tries to create the schema again after a failure', async () => {
    const store = createMemoryStore()
    const ensure = vi.spyOn(store, 'ensureSchema').mockRejectedValueOnce(new Error('cold database'))
    const { deps } = setup({}, store)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect((await handleSyncRequest(post(pull(0)), deps)).status).toBe(502)
    spy.mockRestore()
    expect((await handleSyncRequest(post(pull(0)), deps)).status).toBe(200)
    expect(ensure).toHaveBeenCalledTimes(2)
  })

  it('does not let an older record overwrite a newer one', async () => {
    const { deps } = setup()
    const topic = makeTopic({ updatedAt: 50, nameEs: 'nuevo' })
    await handleSyncRequest(post(push([{ table: 'topics', data: topic }])), deps)
    const response = (await (await handleSyncRequest(post(push([{ table: 'topics', data: { ...topic, updatedAt: 40, nameEs: 'viejo' } }])), deps)).json()) as PushResponse
    expect(response.applied).toBe(0)
    const pulled = (await (await handleSyncRequest(post(pull(0)), deps)).json()) as PullResponse
    expect(pulled.records).toEqual([{ table: 'topics', data: topic }])
  })

  it('refuses invalid records one by one and stores the rest', async () => {
    const { deps } = setup()
    const good = makeTopic()
    const response = (await (await handleSyncRequest(post(push([{ table: 'topics', data: { id: 'x' } }, { table: 'topics', data: good }])), deps)).json()) as PushResponse
    expect(response).toMatchObject({ applied: 1, rejected: [0] })
  })

  it('pages a pull and says when there is more', async () => {
    const { deps } = setup()
    const topics = Array.from({ length: 5 }, (_, i) => makeTopic({ updatedAt: i + 1 }))
    await handleSyncRequest(post(push(topics.map((data) => ({ table: 'topics', data })))), deps)

    const first = (await (await handleSyncRequest(post(pull(0, 2)), deps)).json()) as PullResponse
    expect(first).toMatchObject({ cursor: 2, latest: 5, hasMore: true })
    const last = (await (await handleSyncRequest(post(pull(4, 2)), deps)).json()) as PullResponse
    expect(last).toMatchObject({ cursor: 5, latest: 5, hasMore: false })
    expect(last.records).toHaveLength(1)
  })

  it('cuts a page that would be too big, but always returns at least one record', async () => {
    const { deps } = setup()
    const big = Array.from({ length: 4 }, (_, i) => makeEntry({ updatedAt: i + 1, learnerNote: 'x'.repeat(1_200_000) }))
    // The pushes are small enough one by one; together they pass the response budget.
    for (const entry of big) await handleSyncRequest(post(push([{ table: 'entries', data: entry }])), deps)

    const page = (await (await handleSyncRequest(post(pull(0)), deps)).json()) as PullResponse
    expect(page.records.length).toBeGreaterThanOrEqual(1)
    expect(page.records.length).toBeLessThan(4)
    expect(page.hasMore).toBe(true)
    expect(page.cursor).toBe(page.records.length)
  })

  it('reports an empty pull with the cursor it was given', async () => {
    const { deps } = setup()
    const page = (await (await handleSyncRequest(post(pull(7)), deps)).json()) as PullResponse
    expect(page).toMatchObject({ records: [], cursor: 7, latest: 0, hasMore: false })
  })
})
