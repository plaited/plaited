import { html } from './html.js' 
import { wire } from './wire.js'

/** @returns template string for a web component */
export const component = ({ 
  tag,
  template,
  target,
  triggers,
  id,
  mode = 'open',
  slotted,
  ...rest
}:  {
  tag: string
  template:string
  target?: string
  triggers?: Record<string, string> 
  id?:string,
    /** @defaultValue 'open' */
  mode?: 'open' | 'closed'
  slotted?: string
  [key: string]: unknown
}) => html`
<${tag} ${wire({ target, triggers, id, ...rest })}>
  <template shadowroot="${mode}">
    ${template}
  </template>
  ${slotted}
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
