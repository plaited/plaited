import { ModuleHandler } from './types.js'
import { render } from './render.js'

export const defineModule =
  (handler: ModuleHandler) =>
  async ({ req, ctx, path, dir }: { req: Request; ctx?: Record<string, unknown>; path: string; dir: string }) => {
    const template = await handler(req, ctx)
    return new Response(render({ template, path }), {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  }
