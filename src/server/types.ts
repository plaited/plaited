// Copyright 2022 denosaurs. All rights reserved. MIT license.

import type { ConnInfo } from "../deps.ts";

export type HandlerContext<T = unknown> = T & ConnInfo;

export type Handler<T = unknown> = (
  req: Request,
  ctx: HandlerContext<T>,
) => Response | Promise<Response>;

/**
 * A handler type for anytime the `MatchHandler` or `other` parameter handler
 * fails
 */
export type ErrorHandler<T = unknown> = (
  req: Request,
  ctx: HandlerContext<T>,
  err: unknown,
) => Response | Promise<Response>;

/**
 * A handler type for anytime a method is received that is not defined
 */
export type UnknownMethodHandler<T = unknown> = (
  req: Request,
  ctx: HandlerContext<T>,
  knownMethods: string[],
) => Response | Promise<Response>;

/**
 * A handler type for a router path match which gets passed the matched values
 */
export type MatchHandler<T = unknown> = (
  req: Request,
  ctx: HandlerContext<T>,
  match: Record<string, string>,
) => Response | Promise<Response>;

/**
 * A object for declaring routes that are either `Handler` or `MatchHandler` type
 */
export type Routes<T = unknown> = {
  [x: string]: Handler<T> | MatchHandler<T> 
}


export type ServerCallback<T = unknown>  = (req: Request, ctx: HandlerContext<T>) => void


export type Server<T = unknown>  = (args: {
  root: string
  routes:Routes
  reload?: boolean
  port?: number
  credentials?: {
    key: string
    cert: string
  }
  otherHandler?: Handler<T>
  errorHandler?: ErrorHandler<T>
  unknownMethodHandler?: UnknownMethodHandler<T>
}) =>Promise<{
  addRoutes: (routes: Routes<T>) => void
  ips: string[]
  port?: number
  protocol: 'http' | 'https'
  root: string
  sendReload?: () => void
  url: string
}>

