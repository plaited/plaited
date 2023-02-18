import { GetStoryHandlers } from './types.ts'
import { Handler, Routes } from '../server/mod.ts'
import { entriesTemplate } from './templates/mod.ts'
import { toId } from './to-id.ts'
import { fixture, nav } from './constants.ts'
import { IslandTemplate, PageTemplate } from '../islandly/mod.ts'
import { lowerCase, relative, startCase } from '../deps.ts'
import { NavTemplate } from './templates/nav.ts'

export const getStoryHandlers: GetStoryHandlers = ({
  storiesData,
  entries,
  includes,
  assets,
  dev,
}) => {
  const fmtEntries = entries.map((entry) => relative(assets, entry))
  const routeSets = storiesData.map(
    ([{ title, template }, stories]) => {
      const toRet: Record<string, Handler> = {}
      for (const data of stories) {
        const { args, name } = data
        const story = IslandTemplate({
          tag: fixture,
          template: template(args),
          stylesheets: [...template.stylesheets],
        })
        const navTree = IslandTemplate({
          tag: nav,
          template: NavTemplate({ storiesData }),
          stylesheets: [...NavTemplate.stylesheets],
        })
        const id = toId(title, name)
        Object.assign(toRet, {
          [`/${id}`]: () =>
            new Response(
              PageTemplate({
                title: `${startCase(title)}(${lowerCase(name)})`,
                dev,
                head: [entriesTemplate(fmtEntries), includes?.head]
                  .filter(Boolean).join('\n'),
                body: [navTree, story, includes?.body]
                  .filter(Boolean).join('\n'),
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
