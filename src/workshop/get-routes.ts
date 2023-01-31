import { ServerResponse, IncomingMessage   } from 'http'
import { ssr } from './ssr.ts'
import { toId } from './to-id.ts'
import {  WorksConfig, WorkMeta } from '../types.ts'

export const getRoutes = async (workFiles: string[]) => {
  const routeSets = await Promise.all(workFiles.map(async works => {
    const { default: config, ...rest } = await import(works)
    const { title, fixture, insertBody, insertHead, template } = config as WorksConfig
    const toRet: Record<string,  ((req: IncomingMessage, ctx: ServerResponse) => void)> = {}
    for(const name in rest) {
      const { args } = rest[name] as WorkMeta
      const { page, include } = ssr(template(args), fixture, { insertBody, insertHead })
      const id = toId(title, name)
      Object.assign(toRet, {
        [`/${id}`]: page,
        [`/${id}.include`]: include,
      })
    }
    return toRet
  }))
  const routes: Record<string, (req: IncomingMessage, ctx: ServerResponse) => void> = {}
  for(const set of routeSets) {
    Object.assign(routes, set)
  }
  return routes
}
