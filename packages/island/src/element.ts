import { html } from './html.js' 
import { wire, Wire } from './wire.js'
import { template, Template } from './template.js'


interface ElementProps extends Wire {
  tag: string
  template:string
  /** @defaultValue 'open' */
  mode?: 'open' | 'closed'
  stylesheets?: Set<string>
}

export type Element = Template<ElementProps>
/** @returns template string for a web component */
export const element: Element = template(({ 
  tag,
  template,
  mode = 'open',
  stylesheets,
  ...rest
}) => html`
<${tag} ${wire({ ...rest })}>
  <template shadowroot="${mode}">
    ${stylesheets && html`<style>${[ ...stylesheets ]}</style>`}
    ${template}
  </template>
</${tag}>
`)
