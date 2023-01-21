import { toId } from './to-id'
import { TemplateMeta } from './types'
import { Element } from '@plaited/island'

export const importWork = async (filePath: string, fixtures: { [key: `${string}-${string}`]: Element}) => {
  const { default: defaults, ...rest } = await import(filePath)
  const { title, template, fixture: tag } = defaults as TemplateMeta
  const fixture = fixtures[tag]
  const toRet: { [key:string]: {
    route: () => string
    title: string,
    name: string,
  }} = {}
  const keys = Object.keys(rest)
  for(const name of keys) {
    toRet[`/${toId(title, name )}`] = {
      title,
      name,
      route: () =>  fixture({
        tag,
        template: template((rest)[name].args),
        stylesheets: template.stylesheets,
      }),
    }
  }
  return toRet
}
