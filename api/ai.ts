import { handleAiRequest, productionDeps } from '../src/server/ai/handler.js'

export default {
  fetch(request: Request): Promise<Response> {
    return handleAiRequest(request, productionDeps())
  },
}
