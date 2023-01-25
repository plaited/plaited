import { IncomingMessage, ServerResponse } from 'http'
import { Routes, Handler, ErrorHandler, MatchHandler, UnknownMethodHandler } from './types.js'
// @ts-ignore: Property 'UrlPattern' does not exist
if (!globalThis.URLPattern) { 
  await import('urlpattern-polyfill')
}


/**
 * A record of route paths and `MatchHandler`s which are called when a match is
 * found along with it's values.
 *
 * The route paths follow the path-to-regexp format with the addition of being able
 * to prefix a route with a method name and the `@` sign. For example a route only
 * accepting `GET` requests would look like: `GET@/`.
 */
// export type Routes<T = Record<string, never>> = Record<string, MatchHandler<T>>;

/**
 * The default other handler for the router
 */
export const defaultOtherHandler =( req: IncomingMessage, ctx: ServerResponse) => {
  ctx.writeHead(404, { 'Content-Type': 'text/html' })
  ctx.end('<h1>404 Not Found</h1>')
}

/**
 * The default error handler for the router
 */
export const defaultErrorHandler = (
  req: IncomingMessage,
  ctx: ServerResponse,
  err: unknown
) => {
  ctx.writeHead(500, { 'Content-Type': 'text/plain' })
  ctx.write(`500 ${err}\n`)
  ctx.end()
}

/**
 * The default unknown method handler for the router
 */
export const defaultUnknownMethodHandler = (
  req: IncomingMessage,
  ctx: ServerResponse,
  knownMethods: string[]
) => {
  ctx.writeHead(405, {
    Accept: knownMethods.join(', '),
  })
  ctx.end()
}


export const METHODS = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
  'OPTIONS',
  'PATCH',
] as const

const methodRegex = new RegExp(`(?<=^(?:${METHODS.join('|')}))@`)

/**
 * A simple and tiny router for node
 *
 * ```
 *
 * await serve(
 *   router({
 *     "/": (_req) => new Response("Hello world!", { status: 200 }),
 *   }),
 * );
 * ```
 *
 * @param routes A record of all routes and their corresponding handler functions
 * @param other An optional parameter which contains a handler for anything that
 * doesn't match the `routes` parameter
 * @param error An optional parameter which contains a handler for any time it
 * fails to run the default request handling code
 * @param unknownMethod An optional parameter which contains a handler for any time a method
 * that is not defined is used
 * @returns A requestListener
 */
export function router(
  routes: Routes,
  other: Handler = defaultOtherHandler,
  error: ErrorHandler = defaultErrorHandler,
  unknownMethod: UnknownMethodHandler = defaultUnknownMethodHandler
): Handler {
  const internalRoutes: Record<string, { pattern: URLPattern, methods: Record<string, MatchHandler> }> = {}
  for (const [ route, handler ] of Object.entries(routes)) {
    // eslint-disable-next-line prefer-const
    let [ methodOrPath, path ] = route.split(methodRegex)
    let method = methodOrPath
    if (!path) {
      path = methodOrPath
      method = 'any'
    }
    const r = internalRoutes[path] ?? {
      pattern: new URLPattern({ pathname: path }),
      methods: {},
    }
    r.methods[method] = handler
    internalRoutes[path] = r
  }

  return async (req, ctx) => {
    try {
      for (const { pattern, methods } of Object.values(internalRoutes)) {
        const res = pattern.exec(`http://${req.headers.host}${req.url}`)
        if (res !== null) {
          for (const [ method, handler ] of Object.entries(methods)) {
            if (req.method === method) {
              return await handler(
                req,
                ctx,
                res.pathname.groups
              )
            }
          }
          if (methods['any']) {
            return await methods['any'](
              req,
              ctx,
              res.pathname.groups
            )
          } else {
            return await unknownMethod(
              req,
              ctx,
              Object.keys(methods)
            )
          }
        }
      }

      return await other(req, ctx)
    } catch (err) {
      return error(req, ctx, err)
    }
  }
}
