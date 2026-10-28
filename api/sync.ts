import { handleSyncRequest, productionSyncDeps } from '../src/server/sync/handler.js'

export default {
  fetch(request: Request): Promise<Response> {
    return handleSyncRequest(request, productionSyncDeps())
  },
}
