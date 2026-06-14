type TemplateObject = { html: string[]; stylesheets: string[]; scale: string; $: string }
type FunctionTemplate = (attrs: Record<string, unknown>) => TemplateObject

export const Card: FunctionTemplate = (_attrs) => ({
  html: ['<div class="card"></div>'],
  stylesheets: [],
  scale: 'rel',
  $: '🦄',
})
