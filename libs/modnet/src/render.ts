import type { TemplateObject } from 'plaited'
import { componentMap } from './constants.js'

const rewritePath = (
  path: string,
  obj: {
    path: string
    name: string
  },
) => {}

const importTemplate = (
  arr: {
    path: string
    name: string
  }[],
) => `
await Promise.all(${JSON.stringify(arr, null, 2)}.map(async ({path, name})=> {
  try {
    const modules = await import(path)
    modules[name].define()
  } catch (err) {
    console.error(err)
  }
}))
`

export const render = ({ template, path }: { template: TemplateObject; path: string }) => {
  const { server, stylesheets, registry } = template
  const components: {
    path: string
    name: string
  }[] = []
  for (const mod of registry) {
    const tag = mod.tag
    const obj = componentMap.get(tag)
    if (!obj) {
      console.error(`No module found for ${tag}`)
      continue
    }
    components.push(obj)
  }
  const style = stylesheets.size ? `<style>${[...stylesheets].join('')}</style>` : ''
  const script = components.length ? `<script type="module" async>${importTemplate(components)}</script>` : ''
  const str = server.join('')
  const headIndex = str.indexOf('</head>')
  const bodyRegex = /<body\b[^>]*>/i
  const bodyMatch = bodyRegex.exec(str)
  const bodyIndex = bodyMatch ? bodyMatch.index + bodyMatch[0].length : 0
  const index = headIndex !== -1 ? headIndex : bodyIndex
  return str.slice(0, index) + script + style + str.slice(index)
}
