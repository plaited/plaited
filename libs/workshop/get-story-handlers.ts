import { GetStoryHandlers } from './types.ts'
import { Handler, Routes } from '../server/mod.ts'
import { chatui, fixturePolyfill, registriesTemplate } from './templates/mod.ts'
import { toId } from './to-id.ts'
import { fixture } from './constants.ts'
import { element } from '../island/mod.ts'
import { relative } from '../deps.ts'
import { livereloadTemplate } from '../server/mod.ts'

export const getStoryHandlers: GetStoryHandlers = ({
  storiesData,
  registries,
  page,
  assets,
}) => {
  const fmtRegistries = registries.map((registry) => relative(assets, registry))
  const routeSets = storiesData.map(([{ title }, stories]) => {
    const toRet: Record<string, Handler> = {}
    for (const data of stories) {
      const { args, template, island = fixture, name } = data
      const story = element({
        tag: island,
        template: template(args),
        stylesheets: [...template.stylesheets],
      })
      const id = toId(title, name)
      Object.assign(toRet, {
        [`/${id}`]: () =>
          new Response(
            page({
              head: registriesTemplate(fmtRegistries),
              body: [story, chatui, fixturePolyfill, livereloadTemplate].join(
                '\n',
              ),
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
  })
  const routes: Routes = {}
  for (const set of routeSets) {
    Object.assign(routes, set)
  }
  return routes
}
