import { GetStoryHandlers } from './types.ts'
import { Handler, Routes } from '../server/mod.ts'
import { chatui } from './templates/chatui.ts'
import { toId } from './to-id.ts'
import { fixture } from './constants.ts'
import { element } from '../island/mod.ts'
import { relative } from '../deps.ts'
export const getStoryHandlers: GetStoryHandlers = ({
  storiesData,
  registries,
  page,
  assets,
}) => {
  const fmtRegistries = registries.map((r) => relative(assets, r))
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
        [`/${id}`]: new Response(
          page({ story, registries: fmtRegistries, chatui }),
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
