import type { TemplateObject } from '../jsx/types.js'

export type Handler = <T extends Record<string, unknown> = Record<string, unknown>>(
  req: Request,
  ctx?: T,
) => Promise<Response>

export type ModuleHandler = <T extends Record<string, unknown> = Record<string, unknown>>(
  req: Request,
  ctx?: T,
) => Promise<TemplateObject>

export type MiddleWareHandler = <T extends Record<string, unknown> = Record<string, unknown>>(
  req: Request,
  ctx?: T & { next: Handler },
) => Promise<Response>

export type Context = {
  content: string
  scale: number
  boundary: {
    attrs: string[]
    search: number
  }
  mechanics: unknown
}
