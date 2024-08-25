import { defineTemplate } from '../client/define-template.js'
import { css } from '../client/css.js'
import { h } from '../jsx/create-template.js'
import type { CustomElementTag } from '../jsx/types.js'

export const getTokenElement = (stylesheet: string, tag: CustomElementTag = 'design-tokens') => {
  return defineTemplate({
    tag,
    shadowDom: h('slot', {
      stylesheet: css.assign(
        css.host({
          display: 'contents',
        }),
        { stylesheet },
      ).stylesheet,
    }),
  })
}
