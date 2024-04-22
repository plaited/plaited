import { Component } from 'plaited'
import { styles } from '../../../constants.js'

export const NestedCustomElement = Component({
  tag: 'nested-component',
  template: (
    <>
      <span {...styles.nestedComponent}>inside nested template</span>
      <slot name='nested'></slot>
    </>
  ),
})
