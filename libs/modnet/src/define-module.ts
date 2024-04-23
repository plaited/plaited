import { ModuleHandler } from './types.js'
import { render } from './render.js'

export const defineModule = (handler: ModuleHandler) => async (req: Request, ctx?: Record<string, unknown>) => {
  const template = await handler(req, ctx)
  return new Response(render(template), {
    headers: {
      'Content-Type': 'text/html',
    },
  })
}
