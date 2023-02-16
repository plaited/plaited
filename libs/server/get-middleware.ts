import { Middleware } from './types.ts'

export const getMiddleware: Middleware = (handler) => async (req, ctx) =>
  await handler(req, ctx)
