import { html } from './html.js' 
import { wire, Wire } from './wire.js'



interface Element extends Wire {
  tag: string
  template:string
  /** @defaultValue 'open' */
  mode?: 'open' | 'closed'
}

/** @returns template string for a web component */
export const element = ({ 
  tag,
  template,
  mode = 'open',
  ...rest
}: Element) => html`
<${tag} ${wire({ ...rest })}>
  <template shadowroot="${mode}">
    ${template}
  </template>
</${tag}>
`


/**
 * <mt-comp>
 *  <template shadowroot="open">
 *    <slot></slot>
 *  </template>
 *  <li> dynamcially generate content or whatevs<li>
 * </mt-comp>
 */
