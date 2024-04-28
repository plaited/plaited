import * as fs from 'node:fs'
import { Handler, MiddleWareHandler } from './types.js'
import { isTypeOf } from '@plaited/utils'

export const useMiddleware = async (middleWareFilePath: string, handler: Handler) => {
  const fallback = (req: Request, ctx: Record<string, string>) => handler(req, ctx)
  if (!fs.existsSync(middleWareFilePath)) return fallback
  const { default: middlewareHandler } = await import(middleWareFilePath)
  if (!middlewareHandler) {
    throw new Error(`Default export not found in middleware file: ${middleWareFilePath}`)
  }
  if (!isTypeOf<MiddleWareHandler>(middlewareHandler, 'asyncfunction')) {
    throw new Error(`Default export in middleware file [${middleWareFilePath}] is not an async function`)
  }
  return async (req: Request, ctx: Record<string, string>) => {
    const resp = await middlewareHandler(req, {
      ...ctx,
      next: () => handler(req, ctx),
    })
    if (!isTypeOf<Response>(resp, 'response')) {
      throw new Error(`Middleware handler must return a Response object`)
    }
    return resp
  }
}
