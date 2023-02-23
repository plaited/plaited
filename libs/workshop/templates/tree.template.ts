import { html, template } from '../../islandly/mod.ts'
import { StoriesData } from '../types.ts'
import { startCase } from '../../deps.ts'
import { toId } from '../to-id.ts'

const TreeItem = template<{ title: string; name: string }>(({ title, name }) =>
  html`<li role="none">
    <a
      href="/${toId(title, name)}"
      role="treeitem"
      tabindex="-1"
      data-trigger="click->link keyup->link"
    >
      ${startCase(name)}
    </a>
  </li>`
)

const Group = template<{ title: string; children: string }>((
  { title, children },
) =>
  html`<li role="none">
    <div>
      <span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="10"
          viewBox="0 0 13 10"
        >
          <polygon points="2 1, 12 1, 7 9"></polygon>
        </svg>
      </span>
      ${startCase(title)}
    </div>
    <ul role="group" aria-label="title">
      ${children}
    </ul>
  </li>`
)

type Tree = { [key: string]: string[] | Tree }

const renderTree = (obj: Tree | string[]) => {
  let string = ''
  if (Array.isArray(obj)) {
    return string += obj.join('')
  }
  for (const title in obj) {
    string += Group({ title, children: renderTree(obj[title]) })
  }
  return string
}

export const TreeTemplate = template<{
  storiesData: StoriesData
  project?: string
}>(({
  storiesData,
  project,
}) => {
  const tree: Tree = {}
  for (const [{ title }, stories] of storiesData) {
    const links = stories.map(({ name }) => TreeItem({ name, title }))
    let parent = tree
    title.split('/').forEach((seg, i, arr) => {
      if (i < arr.length - 1) {
        if (!Object.hasOwn(parent, seg)) {
          Object.assign(parent, { [seg]: {} })
        }
        parent = parent[seg] as Tree
        return
      }
      parent[seg] = links
    })
  }
  return html`<nav aria-label="${project ?? 'plaited'} workshop">
    <ul role="tree">
      ${renderTree(tree)}
    </ul>
  <nav>`
})
