import { GetStoryHandlers } from './types.ts'
import { Handler } from '../server/mod.ts'
import { entriesTemplate, PageTemplate, TreeTemplate } from './templates/mod.ts'
import { toId } from './to-id.ts'
import { fixture } from './constants.ts'
import { IslandTemplate } from '../islandly/mod.ts'
import { lowerCase, relative, startCase } from '../deps.ts'

export const getStoryHandlers: GetStoryHandlers = ({
  storiesData,
  entries,
  includes,
  assets,
  dev,
  project,
}) => {
  const fmtEntries = entries.map((entry) => relative(assets, entry))
  const routes: Map<string, Handler> = new Map()
  for (const [{ title, template }, stories] of storiesData) {
    for (const data of stories) {
      const { args = {}, name } = data
      const story = IslandTemplate({
        tag: fixture,
        template: template(args),
      })
      const id = toId(title, name)
      routes.set(`/${id}`, () =>
        new Response(
          PageTemplate({
            title: `${startCase(title)}(${lowerCase(name)})`,
            dev,
            head: [entriesTemplate(fmtEntries), includes?.head]
              .filter(Boolean).join('\n'),
            body: [story, includes?.body]
              .filter(Boolean).join('\n'),
          }),
          {
            headers: { 'Content-Type': 'text/html' },
          },
        ))
    }
  }
  routes.set('/', () =>
    new Response(
      PageTemplate({
        title: `${project ?? 'plaited'} workshop`,
        dev,
        head: [entriesTemplate(fmtEntries), includes?.head]
          .filter(Boolean).join('\n'),
        body: [TreeTemplate({ storiesData, project }), includes?.body]
          .filter(Boolean).join('\n'),
      }),
      {
        headers: { 'Content-Type': 'text/html' },
      },
    ))
  return routes
}
