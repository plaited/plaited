import { type TemplateObject, TemplateObjectSchema } from './html.schemas.ts'

export class Renderer {
  constructor() {
    // Todo Resolver callback fo here it can be called byt any of our private methods.
    // The render buulds up the #templateObject
  }
  #templateObject?: TemplateObject
  async #element() {}
  async #class() {}
  async #host() {}
  async #root() {}
  async #top() {}
  async #keyframe() {}
  async #token() {}
  async #style() {}
  async #template() {}
  async #switch() {}
  async #path() {}
  static ssr(tpl: TemplateObject): string {
    TemplateObjectSchema.parse(tpl)
    const stylesheets = new Set(tpl.stylesheets)
    let pre = ''
    if (stylesheets.size) {
      pre = `<style>${[...stylesheets]
        .join('')
        .replaceAll(/:host\{/g, ':root{')
        .replaceAll(/:host\(([^)]+)\)/g, ':root$1')}</style>\n`
    }
    const str = tpl.html.join('')
    const headIndex = str.indexOf('</head>')
    const bodyRegex = /<body\b[^>]*>/i
    const bodyMatch = bodyRegex.exec(str)
    const bodyIndex = bodyMatch ? bodyMatch.index + bodyMatch[0].length : 0
    const index = headIndex === -1 ? bodyIndex : headIndex
    return str.slice(0, index) + pre + str.slice(index)
  }
  getTemplateObject(nodes): TemplateObject {
    // this takes flatnodes as a list of them
    this.#templateObject = undefined
    for (const node of nodes) {
    }
  }
}
