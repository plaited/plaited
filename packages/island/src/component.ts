import { html } from './html.js' 
import { dataTarget as targetAttr } from './data-target.js'
import { dataTrigger as triggerAttr } from './data-trigger.js'

/** @returns template string for a web component */
export const component = ({ 
  tag,
  template,
  dataTarget,
  dataTrigger,
  id,
  mode = 'open',
}:  {
  tag: string
  template:string
  dataTarget?: string
  dataTrigger?: Parameters<typeof triggerAttr>[0]
  id?:string,
    /** @defaultValue 'open' */
  mode?: 'open' | 'closed'
}) => html`
<${tag}
  ${id && `id="${id}"`}
  ${dataTarget && targetAttr(dataTarget)}
  ${dataTrigger && triggerAttr(dataTrigger)}
>
  <template shadowroot="${mode}">
    ${template}
  </template>
</${tag}>
`
