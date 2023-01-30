import {
  Handler,
  HandlerContext,
  ErrorHandler,
  MatchHandler,
  Routes,
  UnknownMethodHandler,
} from './types.ts'

/**
 * The default other handler for the router
 */
export function defaultOtherHandler(_req: Request): Response {
  return new Response(null, {
    status: 404,
  })
}

/**
 * The default error handler for the router
 */
export function defaultErrorHandler(
  _req: Request,
  _ctx: HandlerContext,
  err: unknown,
): Response {
  console.error(err)

  return new Response(null, {
    status: 500,
  })
}

/**
 * The default unknown method handler for the router
 */
export function defaultUnknownMethodHandler(
  _req: Request,
  _ctx: HandlerContext,
  knownMethods: string[],
): Response {
  return new Response(null, {
    status: 405,
    headers: {
      Accept: knownMethods.join(", "),
    },
  })
}

export const METHODS = [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "DELETE",
  "OPTIONS",
  "PATCH",
] as const

const methodRegex = new RegExp(`(?<=^(?:${METHODS.join("|")}))@`)

/**
 * A simple and tiny router for deno
 *
 * ```
 * import { serve } from "https://deno.land/std/http/server.ts"
 * import { router } from "https://crux.land/router@0.0.9"
 *
 * await serve(
 *   router({
 *     "/": (_req) => new Response("Hello world!", { status: 200 }),
 *   }),
 * )
 * ```
 *
 * @param routes A record of all routes and their corresponding handler functions
 * @param other An optional parameter which contains a handler for anything that
 * doesn't match the `routes` parameter
 * @param error An optional parameter which contains a handler for any time it
 * fails to run the default request handling code
 * @param unknownMethod An optional parameter which contains a handler for any time a method
 * that is not defined is used
 * @returns A deno std compatible request handler
 */
export function router<T = unknown>(
  routes: Routes<T>,
  other: Handler<T> = defaultOtherHandler,
  error: ErrorHandler<T> = defaultErrorHandler,
  unknownMethod: UnknownMethodHandler<T> = defaultUnknownMethodHandler,
): Handler<T> {
  const internalRoutes: Record<string, { pattern: URLPattern, methods: Record<string, MatchHandler<T>> }> = {}
  for (const [route, handler] of Object.entries(routes)) {
    let [methodOrPath, path] = route.split(methodRegex)
    let method = methodOrPath
    if (!path) {
      path = methodOrPath
      method = "any"
    }
    const r = internalRoutes[path] ?? {
      pattern: new URLPattern({ pathname: path }),
      methods: {}
    }
    r.methods[method] = handler
    internalRoutes[path] = r
  }

  return async (req, ctx) => {
    try {
      for (const { pattern, methods } of Object.values(internalRoutes)) {
        const res = pattern.exec(req.url)
        if (res !== null) {
          for (const [method, handler] of Object.entries(methods)) {
            if (req.method === method) {
              return await handler(
                req,
                ctx,
                res.pathname.groups,
              )
            }
          }
          if (methods["any"]) {
            return await methods["any"](
              req,
              ctx,
              res.pathname.groups,
            )
          } else {
            return await unknownMethod(
              req,
              ctx,
              Object.keys(methods),
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
