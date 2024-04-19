import type { TemplateObject } from 'plaited'
import './html-element.js'

const importTemplate = (arr: [string, string][]) => `
await Promise.all(${JSON.stringify(arr, null, 2)}.map(async ([tag, path])=> {
  try {
    const modules = await import(path)
    modules[tag].define()
  } catch (err) {
    console.error(err)
  }
}))
`

export const render = (template: TemplateObject) => {
    return (modulesMap: Map<string, string>) => {
      const { server, stylesheets, registry } = template
      const modulePaths: [string, string][] = []
      for(const mod of registry){
        const tag = mod.tag
        const path = modulesMap.get(tag)
        if(!path) {
          console.error(`No module found for ${tag}`)
          continue
        }
        modulePaths.push([tag, path])
      }
      const style = stylesheets.size ? `<style>${[...stylesheets].join('')}</style>` : ''
      const script = modulePaths.length ? `<script type="module" async>${importTemplate(modulePaths)}</script>` : ''
      const str = server.join('')
      const headIndex = str.indexOf('</head>')
      const bodyRegex = /<body\b[^>]*>/i
      const bodyMatch = bodyRegex.exec(str)
      const bodyIndex = bodyMatch ? bodyMatch.index + bodyMatch[0].length : 0
      const index = headIndex !== -1 ? headIndex : bodyIndex
      return str.slice(0, index) + script + style + str.slice(index)
  }
}