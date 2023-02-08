import { GetStoryHandlers, Routes } from './types.ts'
import { Handler } from '../server/mod.ts'
import { chatui } from './templates/chatui.ts'
import { storyWrapper } from './story-wrapper.ts'
import { kebabCase } from '../deps.ts'
import { fixture } from './constants.ts'

export const getStoryHandlers: GetStoryHandlers = ({
  storiesData,
  registries,
  page,
}) => {
  const routeSets = storiesData.map(([{ title }, stories]) => {
    const subRoutes: Record<string, Handler> = {}
    for (const data of stories) {
      const { args, template, island = fixture, name } = data
      const story = storyWrapper(island, template(args))
      const id = kebabCase(name)
      Object.assign(subRoutes, {
        [`/${id}`]: new Response(page({ story, registries, chatui }), {
          headers: { 'Content-Type': 'text/html' },
        }),
        [`/${id}.include`]: () =>
          new Response(story, {
            headers: { 'Content-Type': 'text/html' },
          }),
      })
    }
    const toRet: Routes = {}
    const titlePath = title.toLowerCase().split('/')
    for (let i = 0; i < titlePath.length; i++) {
      const cur = titlePath[i]
      toRet[cur] = i === titlePath.length - 1 ? subRoutes : {}
    }
    return toRet
  })
  const routes: Routes = {}
  for (const set of routeSets) {
    Object.assign(routes, set)
  }
  return routes
}
