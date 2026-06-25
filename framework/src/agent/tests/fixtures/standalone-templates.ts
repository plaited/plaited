/**
 * Self-contained fixture for TSC static-analysis tests.
 * No external imports — the type checker resolves everything from this file.
 */

type TemplateObject = {
  html: string[]
  stylesheets: string[]
  scale: string
  $: string
}

export const Box = (_attrs: Record<string, unknown>): TemplateObject => ({
  html: ['<div></div>'],
  stylesheets: [],
  scale: 'rel',
  $: '🦄',
})

export const Heading = (_attrs: Record<string, unknown>): TemplateObject => ({
  html: ['<h1></h1>'],
  stylesheets: [],
  scale: 'rel',
  $: '🦄',
})

export const Banner = (_attrs: Record<string, unknown>): TemplateObject => ({
  html: ['<header></header>'],
  stylesheets: [],
  scale: 'rel',
  $: '\u{1F984}',
})

export const notATemplate = () => 'hello'

export const wrongArity = (_a: string, _b: string): TemplateObject => ({
  html: [],
  stylesheets: [],
  scale: 'rel',
  $: '\u{1F984}',
})

export const returnsWrongShape = () => ({ html: [] })

export const someString = 'hello'
export const someNumber = 42
