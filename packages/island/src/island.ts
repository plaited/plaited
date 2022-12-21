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
  ...rest
}:  {
  tag: string
  template:string
  target?: string
  triggers?: Record<string, string> 
  id?:string,
    /** @defaultValue 'open' */
  mode?: 'open' | 'closed'
  [key: string]: unknown
}) => html`
<${tag} ${wire({ target, triggers, id, ...rest })}>
  <template shadowroot="${mode}">
    ${template}
  </template>
</${tag}>
`
