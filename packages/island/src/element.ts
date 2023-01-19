import { html } from './html.js' 
import { wire, Wire } from './wire.js'
import { template } from './template.js'


export interface Element extends Wire {
  tag: string
  template:string
  /** @defaultValue 'open' */
  mode?: 'open' | 'closed'
  stylesheets?: Set<string>
}

/** @returns template string for a web component */
export const element = template<Element>(({ 
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
/**
 * <mt-comp>
 *  <template shadowroot="open">
 *    <slot></slot>
 *  </template>
 *  <li> dynamcially generate content or whatevs<li>
 * </mt-comp>
 */
