import { Component } from '@plaited/component'
import { css } from '@plaited/jsx'
import { stylesheets } from '@plaited/jsx/utils'

const { $stylesheet } = css`
  :host {
    display: contents;
  }
`
export const getTokenElement = (stylesheet: string, tag: `${string}-${string}` = 'design-tokens') => {
  return class DesignTokensElement extends Component({
    tag,
    template: <slot stylesheet={stylesheets($stylesheet, stylesheet)}></slot>,
  }) {}
}
