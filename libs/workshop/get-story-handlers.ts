import { GetStoryHandlers } from './types.ts'
import { Handler, page, Routes } from '../server/mod.ts'
import { registriesTemplate } from './templates/mod.ts'
import { toId } from './to-id.ts'
import { fixture } from './constants.ts'
import { IslandTemplate } from '../island/mod.ts'
import { lowerCase, relative, startCase } from '../deps.ts'

export const getStoryHandlers: GetStoryHandlers = ({
  storiesData,
  registries,
  includes,
  assets,
  dev,
}) => {
  const fmtRegistries = registries.map((registry) => relative(assets, registry))
  const routeSets = storiesData.map(
    ([{ title, island = fixture, template }, stories]) => {
      const toRet: Record<string, Handler> = {}
      for (const data of stories) {
        const { args, name } = data
        const story = IslandTemplate({
          tag: island,
          template: template(args),
          stylesheets: [...template.stylesheets],
        })
        const id = toId(title, name)
        Object.assign(toRet, {
          [`/${id}`]: () =>
            new Response(
              page({
                title: `${startCase(title)}(${lowerCase})`,
                dev,
                head: [registriesTemplate(fmtRegistries), includes?.head]
                  .filter(Boolean).join('\n'),
                body: [story, includes?.body].filter(Boolean)
                  .join('\n'),
              }),
              {
                headers: { 'Content-Type': 'text/html' },
              },
            ),
          [`/${id}.include`]: () =>
            new Response(story, {
              headers: { 'Content-Type': 'text/html' },
            }),
        })
      }
      return toRet
    },
  )
  const routes: Routes = {}
  for (const set of routeSets) {
    Object.assign(routes, set)
  }
  return routes
}
