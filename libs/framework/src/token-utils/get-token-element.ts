import { Component, css, h, assignStyles } from 'plaited'

export const getTokenElement = (stylesheet: string, tag: `${string}-${string}` = 'design-tokens') => {
  return Component({
    tag,
    template: h('slot', {
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
