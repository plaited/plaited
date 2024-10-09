import { defineTemplate } from '../client/define-template.ts'
import { css } from '../css/css.ts'
import { h } from '../jsx/create-template.ts'
import type { CustomElementTag } from '../jsx/jsx.types.ts'

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
