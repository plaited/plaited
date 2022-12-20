import { html } from './html.js' 

type Island = (args: {
  tag: string
  template:string
  id?:string,
    /** @defaultValue 'open' */
  mode?: 'open' | 'closed'
}) => string

export const island: Island = ({ 
  tag,
  template,
  id,
  mode = 'open',
}) => html`
<${tag} ${id && `id="${id}"`}>
  <template shadowroot="${mode}">
    ${template}
  </template>
</${tag}>
`
