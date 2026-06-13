/**
 * Self-contained fixture for TSC static-analysis tests.
 * No external imports — the type checker resolves everything from this file.
 */

type TemplateObject = {
  html: string[]
  stylesheets: string[]
  registry: string[]
  scale: string
  $: string
}

type FunctionTemplate = (attrs: Record<string, unknown>) => TemplateObject

export const Box: FunctionTemplate = (_attrs) => ({
  html: ['<div></div>'],
  stylesheets: [],
  registry: [],
  scale: 'rel',
  $: '\u{1F984}',
})

export const Heading: FunctionTemplate = (_attrs) => ({
  html: ['<h1></h1>'],
  stylesheets: [],
  registry: [],
  scale: 'rel',
  $: '\u{1F984}',
})

export const Banner = (_attrs: Record<string, unknown>): TemplateObject => ({
  html: ['<header></header>'],
  stylesheets: [],
  registry: [],
  scale: 'rel',
  $: '\u{1F984}',
})

export const notATemplate = () => 'hello'

export const wrongArity = (_a: string, _b: string): TemplateObject => ({
  html: [],
  stylesheets: [],
  registry: [],
  scale: 'rel',
  $: '\u{1F984}',
})

export const returnsWrongShape = () => ({ html: [] })

export const someString = 'hello'
export const someNumber = 42
