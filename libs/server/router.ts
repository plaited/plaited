/** Fork of rutt drops nesting */

import { ConnInfo } from '../deps.ts'
/**
 * Provides arbitrary context to {@link Handler} functions along with
 * {@link ConnInfo connection information}.
 */
export type HandlerContext<T = unknown> = T & ConnInfo

/**
 * A handler for HTTP requests. Consumes a request and {@link HandlerContext}
 * and returns an optionally async response.
 */
export type Handler<T = unknown> = (
  req: Request,
  ctx: HandlerContext<T>,
) => Response | Promise<Response>

/**
 * A handler type for anytime the `MatchHandler` or `other` parameter handler
 * fails
 */
export type ErrorHandler<T = unknown> = (
  req: Request,
  ctx: HandlerContext<T>,
  err: unknown,
) => Response | Promise<Response>

/**
 * A handler type for anytime a method is received that is not defined
 */
export type UnknownMethodHandler<T = unknown> = (
  req: Request,
  ctx: HandlerContext<T>,
  knownMethods: string[],
) => Response | Promise<Response>

/**
 * A handler type for a router path match which gets passed the matched values
 */
export type MatchHandler<T = unknown> = (
  req: Request,
  ctx: HandlerContext<T>,
  match: Record<string, string>,
) => Response | Promise<Response>

/**
 * A map of route paths and {@link MatchHandler}s which are called when a match is
 * found along with it's values.
 *
 * The route paths follow the {@link URLPattern} format with the addition of
 * being able to prefix a route with a method name and the `@` sign. For
 * example a route only accepting `GET` requests would look like: `GET@/`.
 */

export type Routes<T = unknown> = Map<string, MatchHandler<T>>

type InternalRoutes<T = unknown> = {
  pattern: URLPattern | RegExp
  methods: Record<string, MatchHandler<T>>
}[]

/**
 * A known HTTP method.
 */
export type KnownMethod = typeof knownMethods[number]

/**
 * All known HTTP methods.
 */
export const knownMethods = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
  'OPTIONS',
  'PATCH',
] as const

/**
 * The default other handler for the router. By default it responds with `null`
 * body and a status of 404.
 */
export const defaultOtherHandler: Handler = (_req) =>
  new Response(null, {
    status: 404,
  })

/**
 * The default error handler for the router. By default it responds with `null`
 * body and a status of 500 along with `console.error` logging the caught error.
 */
export const defaultErrorHandler: ErrorHandler = (
  _req,
  _ctx,
  err,
) => {
  console.error(err)

  return new Response(null, {
    status: 500,
  })
}

/**
 * The default unknown method handler for the router. By default it responds
 * with `null` body, a status of 405 and the `Accept` header set to all
 * {@link KnownMethod known methods}.
 */
export const defaultUnknownMethodHandler: UnknownMethodHandler = (
  _req,
  _ctx,
  knownMethods,
) =>
  new Response(null, {
    status: 405,
    headers: {
      Accept: knownMethods.join(', '),
    },
  })

/**
 * Additional options for the {@link router} function.
 */
export interface RouterOptions<T> {
  /**
   * An optional property which contains a handler for anything that doesn't
   * match the `routes` parameter
   */
  otherHandler?: Handler<T>
  /**
   * An optional property which contains a handler for any time it fails to run
   * the default request handling code
   */
  errorHandler?: ErrorHandler<T>
  /**
   * An optional property which contains a handler for any time a method that
   * is not defined is used
   */
  unknownMethodHandler?: UnknownMethodHandler<T>
}

const knownMethodRegex = new RegExp(`(?<=^(?:${knownMethods.join('|')}))@`)

/**
 * Builds an {@link InternalRoutes} array from a {@link Routes} record.
 *
 * @param routes A {@link Routes} record
 * @returns The built {@link InternalRoutes}
 */
export function buildInternalRoutes<T = unknown>(
  routes: Routes<T>,
): InternalRoutes<T> {
  const toRet: Map<
    string,
    { pattern: URLPattern; methods: Record<string, MatchHandler<T>> }
  > = new Map()
  routes.forEach((handler, route) => {
    let [methodOrPath, path] = route.split(knownMethodRegex)
    let method = methodOrPath
    if (!path) {
      path = methodOrPath
      method = 'any'
    }
    const fmtPath = path.startsWith('/') ? path : `/${path}`
    const r = toRet.get(fmtPath) ?? {
      pattern: new URLPattern({ pathname: fmtPath }),
      methods: {},
    }
    r.methods[method] = handler
    toRet.set(fmtPath, r)
  })
  return [...toRet.values()]
}

/**
 * A simple and tiny router for deno. This function provides a way of
 * constructing a HTTP request handler for the provided {@link routes} and any
 * provided {@link RouterOptions}.
 *
 * @example
 * ```ts
 * import { serve } from "https://deno.land/std/http/server.ts";
 * import { router } from "https://deno.land/x/rutt/mod.ts";
 * const routes = new Map()
 * routes.set('/', (_req) => new Response("Hello world!", { status: 200 }))
 * await serve(
 *   router(routes),
 * );
 * ```
 *
 * @param routes A record of all routes and their corresponding handler functions
 * @param options An object containing all of the possible configuration options
 * @returns A deno std compatible request handler
 */
export function router<T = unknown>(
  routes: Routes<T> | InternalRoutes<T>,
  options: RouterOptions<T> = {},
): Handler<T> {
  const {
    otherHandler = defaultOtherHandler,
    errorHandler = defaultErrorHandler,
    unknownMethodHandler = defaultUnknownMethodHandler,
  } = options
  const internalRoutes = Array.isArray(routes)
    ? routes
    : buildInternalRoutes(routes)

  return async (req, ctx) => {
    try {
      for (const { pattern, methods } of internalRoutes) {
        const res = pattern.exec(req.url)
        const groups = (pattern instanceof URLPattern
          ? (res as URLPatternResult | null)?.pathname.groups
          : (res as RegExpExecArray | null)?.groups) ?? {}
        for (const key in groups) {
          groups[key] = decodeURIComponent(groups[key])
        }
        if (res !== null) {
          for (const [method, handler] of Object.entries(methods)) {
            if (req.method === method) {
              return await handler(
                req,
                ctx,
                groups,
              )
            }
          }
          if (methods['any']) {
            return await methods['any'](
              req,
              ctx,
              groups,
            )
          } else {
            return await unknownMethodHandler(
              req,
              ctx,
              Object.keys(methods),
            )
          }
        }
      }

      return await otherHandler!(req, ctx)
    } catch (err) {
      return errorHandler!(req, ctx, err)
    }
  }
}
