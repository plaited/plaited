import { html } from './html.ts'
import { Wire, wire } from './wire.ts'
import { template } from './template.ts'

interface ElementProps extends Wire {
  tag: string
  template: string
  /** @defaultValue 'open' */
  mode?: 'open' | 'closed'
  stylesheets?: string | string[]
}

export const element = template<ElementProps>(({
  tag,
  template,
  mode = 'open',
  stylesheets,
  ...rest
}) => {
  const sheets = Array.isArray(stylesheets)
    ? [...new Set(stylesheets)]
    : stylesheets
  return html`
  <${tag} ${wire({ ...rest })}>
    <template shadowroot="${mode}">
      ${stylesheets && html`<style>${sheets}</style>`}
      ${template}
    </template>
  </${tag}>
  `
})
