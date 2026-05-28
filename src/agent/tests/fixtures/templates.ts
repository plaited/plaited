type TemplateObject = {
  html: string[]
  stylesheets: string[]
  registry: string[]
  scale: string
  $: string
}

type FunctionTemplate = (attrs: Record<string, unknown>) => TemplateObject

const h = (tag: string, _attrs: Record<string, unknown>): TemplateObject => ({
  html: [`<${tag}></${tag}>`],
  stylesheets: [],
  registry: [],
  scale: 'rel',
  $: '🦄',
})

export const Button: FunctionTemplate = ({ children, ...attrs }) => h('button', { ...attrs, children })

export const Heading: FunctionTemplate = ({ children }) => h('h1', { children })

/**
 * Destructures `classNames` without a default.
 * A runtime probe would throw, so a pure arity-check would reject it.
 * TSC static analysis finds it because it checks the type signature.
 */
export const FragileTemplate: FunctionTemplate = ({ classNames, children }) => {
  // @ts-expect-error: classNames may be undefined — demonstrates runtime fragility
  const safe = classNames.map((s) => s)
  return h('div', { classNames: safe, children })
}

export const regularFunction = () => 'not a template'

export const wrongArity = (a: string, b: string) => h('div', { children: `${a}${b}` })

export const returnsWrongShape = () => ({ html: [], stylesheets: [] })

export const someString = 'hello'
export const someNumber = 42
