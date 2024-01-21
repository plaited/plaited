import { Component, css, h } from 'plaited'
import { stylesheets } from 'plaited/css'

const { $stylesheet } = css`
  :host {
    display: contents;
  }
`

export const getTokenElement = (stylesheet: string, tag: `${string}-${string}` = 'design-tokens') => {
  return Component({
    tag,
    template: h('slot', { stylesheet: stylesheets($stylesheet, stylesheet) }),
  })
}
