import { Routes } from '../server/mod.ts'
import { entriesTemplate, PageTemplate, TreeTemplate } from './templates/mod.ts'
import { StoriesData } from './types.ts'
export const setRootRoute = ({
  dev,
  entries,
  includes,
  project,
  routes,
  storiesData,
}: {
  dev: boolean
  entries: string[]
  includes?: {
    head?: string
    body?: string
  }
  project?: string
  routes: Routes
  storiesData: StoriesData
}) => {
  routes.set('/', () =>
    new Response(
      PageTemplate({
        title: `${project ?? 'plaited'} workshop`,
        dev,
        head: [entriesTemplate(entries), includes?.head]
          .filter(Boolean).join('\n'),
        body: [TreeTemplate({ storiesData, project }), includes?.body]
          .filter(Boolean).join('\n'),
      }),
      {
        headers: { 'Content-Type': 'text/html' },
      },
    ))
}
