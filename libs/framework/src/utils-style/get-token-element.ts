import { defineTemplate } from '../client/define-template.js'
import { css } from '../css/css.js'
import { assignStyles } from '../css/assign-styles.js'
import { h } from '../jsx/create-template.js'

export const getTokenElement = (stylesheet: string, tag: `${string}-${string}` = 'design-tokens') => {
  return defineTemplate({
    tag,
    shadowRoot: h('slot', {
      stylesheet: assignStyles(
        css`
          :host {
            display: contents;
          }
        `,
        { stylesheet },
      ).stylesheet,
    }),
  })
}
