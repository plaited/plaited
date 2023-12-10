import { Component } from '@plaited/component'
import { css } from '@plaited/jsx'
import { stylesheets } from '@plaited/jsx/utils'

export const TokensTag: `${string}-${string}` = 'design-tokens'

const { $stylesheet } = css`
  :host {
    display: contents;
  }
`
export const getTokenElement = (stylesheet: string, tag = TokensTag) => {
  return class DesignTokensElement extends Component({
    tag,
    template: <slot stylesheet={stylesheets($stylesheet, stylesheet)}></slot>,
  }) {}
}
