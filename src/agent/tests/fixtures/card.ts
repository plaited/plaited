type TemplateObject = { html: string[]; stylesheets: string[]; registry: string[]; scale: string; $: string }
type FunctionTemplate = (attrs: Record<string, unknown>) => TemplateObject

export const Card: FunctionTemplate = (_attrs) => ({
  html: ['<div class="card"></div>'],
  stylesheets: [],
  registry: [],
  scale: 'rel',
  $: '🦄',
})
