// -- brotli --
export { compress } from 'https://deno.land/x/brotli@0.1.7/mod.ts'

// -- rutt --
import { Routes as _Routes } from 'https://deno.land/x/rutt@0.1.0/mod.ts'
export {
  type ErrorHandler,
  type Handler,
  type HandlerContext,
  type MatchHandler,
  router,
  type UnknownMethodHandler,
} from 'https://deno.land/x/rutt@0.1.0/mod.ts'

// fix type conflict by passing in unknown
export type Routes<T = unknown> = _Routes<T>

// -- std --
export { serveDir } from 'https://deno.land/std@0.177.0/http/file_server.ts'
export {
  type ConnInfo,
  serve,
  serveTls,
} from 'https://deno.land/std@0.177.0/http/server.ts'
