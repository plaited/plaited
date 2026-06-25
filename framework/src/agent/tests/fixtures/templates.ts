type TemplateObject = {
  html: string[]
  stylesheets: string[]
  scale: string
  $: string
}

const h = (tag: string, _attrs: Record<string, unknown>): TemplateObject => ({
  html: [`<${tag}></${tag}>`],
  stylesheets: [],
  scale: 'rel',
  $: '🦄',
})

export const regularFunction = () => 'not a template'

export const wrongArity = (a: string, b: string) => h('div', { children: `${a}${b}` })

export const returnsWrongShape = () => ({ html: [], stylesheets: [] })

export const someString = 'hello'
export const someNumber = 42
