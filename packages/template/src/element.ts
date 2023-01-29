import { html } from './html.js' 
import { wire, Wire } from './wire.js'
import { template, Template } from './template.js'


interface ElementProps extends Wire {
  tag: string
  template:string
  /** @defaultValue 'open' */
  mode?: 'open' | 'closed'
  stylesheets?: string | string[]
}

export type Element = Template<ElementProps>
/** @returns template string for a web component */
export const element: Element = template(({ 
  tag,
  template,
  mode = 'open',
  stylesheets,
  ...rest
}) => {
  const sheets = new Set(Array.isArray(stylesheets) ? stylesheets : [ stylesheets ]) 
  return html`
  <${tag} ${wire({ ...rest })}>
    <template shadowroot="${mode}">
      ${stylesheets && html`<style>${[ ...sheets ]}</style>`}
      ${template}
    </template>
  </${tag}>
  `
})
