import type { Handler, MiddleWareHandler } from './bun.types.js'

export const useMiddleware = (middleware?: MiddleWareHandler) => {
  return async (handler: Handler) => {
    if (!middleware) return (req: Request, ctx: Record<string, string>) => handler(req, ctx)
    return async (req: Request, ctx: Record<string, string>) => {
      const resp = await middleware(req, {
        ...ctx,
        next: () => handler(req, ctx),
      })
      return resp
    }
  }
}
