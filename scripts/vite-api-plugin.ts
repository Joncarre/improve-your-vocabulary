import { existsSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { loadEnv, type Plugin, type ViteDevServer } from 'vite'

type FetchHandler = (request: Request) => Response | Promise<Response>

interface ApiModule {
  default?: { fetch?: FetchHandler }
  [exportName: string]: unknown
}

/**
 * Serves the Vercel Functions in `api/` from the Vite dev server, so `npm run dev` is all that is
 * needed locally. Supports the two handler shapes Vercel accepts: `export default { fetch }` and
 * named `GET` / `POST` exports. Environment variables come from `.env.local`.
 */
export function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev-middleware',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, server.config.root, ''))
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          next()
          return
        }
        handle(server, req, res).catch((error: unknown) => {
          server.config.logger.error(`[api] ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`)
          sendJson(res, 500, { error: 'Internal error' })
        })
      })
    },
  }
}

async function handle(server: ViteDevServer, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const name = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '')
  const file = join(server.config.root, 'api', `${name}.ts`)
  if (!/^[a-z0-9-]+$/i.test(name) || !existsSync(file)) {
    sendJson(res, 404, { error: 'Not found' })
    return
  }

  const mod = (await server.ssrLoadModule(`/api/${name}.ts`)) as ApiModule
  const method = req.method ?? 'GET'
  const handler = pickHandler(mod, method)
  if (!handler) {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }
  const init: RequestInit & { duplex?: 'half' } = { method, headers }
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = Readable.toWeb(req) as ReadableStream
    init.duplex = 'half'
  }

  const response = await handler(new Request(url, init))
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(Buffer.from(await response.arrayBuffer()))
}

function pickHandler(mod: ApiModule, method: string): FetchHandler | undefined {
  const target = mod.default
  if (target && typeof target.fetch === 'function') {
    const fetchHandler = target.fetch
    return (request) => fetchHandler.call(target, request)
  }
  const named = mod[method]
  return typeof named === 'function' ? (named as FetchHandler) : undefined
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}
