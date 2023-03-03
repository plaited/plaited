import { StorySetData } from './types.ts'
import { livereloadTemplate, Routes } from '../server/mod.ts'
import { toId } from './to-id.ts'
import { html } from '../islandly/mod.ts'

export const setStoryRoutes = ({
  dev,
  routes,
  data,
}: {
  dev: boolean
  routes: Routes
  data: StorySetData
}) => {
  for (const [{ title, template, path }, stories] of data) {
    for (const data of stories) {
      const { args = {}, name } = data
      const id = toId(title, name)
      routes.set(`/${id}`, () =>
        new Response(
          html`
          <script type="module" src="${path}"></script>
          ${
            template.styles.size && html`<style>${[...template.styles]}</style>`
          }
          ${template(args)}
          ${dev && livereloadTemplate}
          `,
          {
            headers: { 'Content-Type': 'text/html' },
          },
        ))
    }
  }
}
