import { html } from './html.js' 
import { wire } from './wire.js'

/** @returns template string for a web component */
export const island = ({ 
  tag,
  template,
  target,
  triggers,
  id,
  mode = 'open',
}:  {
  tag: string
  template:string
  target?: string
  triggers?: Record<string, string> 
  id?:string,
    /** @defaultValue 'open' */
  mode?: 'open' | 'closed'
}) => html`
<${tag}
  ${id && `id="${id}"`}
  ${wire({ target, triggers })}
>
  <template shadowroot="${mode}">
    ${template}
  </template>
</${tag}>
`
