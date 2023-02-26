import { Routes } from '../server/mod.ts'
import { storiesPath, testPath, testsID, testSocketPath } from './constants.ts'
import { getWebSocket } from './get-web-socket.ts'
import { entriesTemplate, PageTemplate } from './templates/mod.ts'
import { html } from '../islandly/mod.ts'

export const setTestsRoutes = (
  {
    dev,
    entries,
    stories,
    includes,
    project,
    routes,
    runner,
  }: {
    dev: boolean
    entries: string[]
    stories: string[]
    includes?: {
      head?: string
      body?: string
    }
    project?: string
    routes: Routes
    runner: string[]
  },
) => {
  routes.set(
    `GET@/${storiesPath}`,
    () =>
      new Response(
        JSON.stringify(stories.map((path) => `/${path}`)),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
  )
  routes.set(testPath, () =>
    new Response(
      PageTemplate({
        title: `${project ?? 'plaited'} workshop tests`,
        dev,
        head: [entriesTemplate(entries), includes?.head]
          .filter(Boolean).join('\n'),
        body: [
          html`<ul id="${testsID}"></ul>`,
          entriesTemplate(runner),
          includes?.body,
        ]
          .filter(Boolean).join('\n'),
      }),
      {
        headers: { 'Content-Type': 'text/html' },
      },
    ))
  routes.set(testSocketPath, getWebSocket)
}
