import { bElement, type CustomElementTag, css, h } from '../../main.js'

export const getTokenElement = (stylesheet: string, tag: CustomElementTag = 'design-tokens') => {
  return bElement({
    tag,
    shadowDom: h('slot', {
      stylesheet: css.join(
        css.host({
          display: 'contents',
        }),
        { stylesheet: [stylesheet] },
      ).stylesheet,
    }),
  })
}
