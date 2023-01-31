import { toId } from './to-id.ts'
import { StoryHandlers, } from './types.ts'
import {  Handler } from '../server.ts'
import { page } from './page.ts'
import { ssr } from './ssr.ts'

export const defaultStoryHandlers: StoryHandlers =(storyData) => {
  const routeSets = storyData.map(([{title}, stories]) => {
    const toRet: Record<string, Handler> = {}
    for (const data of stories) {
      const { args, template, fixture, name } = data
      const story = ssr(fixture, template(args))
      const id = toId(title, name)
      Object.assign(toRet, {
        [`/${id}`]: new Response(page(story), {
          headers: { 'Content-Type': 'text/html' },
        }),
        [`/${id}.include`]: () => new Response(story, {
            headers: { 'Content-Type': 'text/html' },
          }),
      })
    }
    return toRet
  })
  const routes: Record<string, Handler> = {}
  for (const set of routeSets) {
    Object.assign(routes, set)
  }
  return routes
}
