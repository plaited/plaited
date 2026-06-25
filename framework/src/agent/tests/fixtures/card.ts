type TemplateObject = { html: string[]; stylesheets: string[]; scale: string; $: string }

export const Card = (_attrs: Record<string, unknown>): TemplateObject => ({
  html: ['<div class="card"></div>'],
  stylesheets: [],
  scale: 'rel',
  $: '🦄',
})
