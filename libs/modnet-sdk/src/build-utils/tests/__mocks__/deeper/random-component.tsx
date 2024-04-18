import { Component } from 'plaited'
import { styles } from './constants.js'

export const RadomComponent = Component({
  tag: 'random-component',
  template: (
    <>
      <span {...styles.nestedLabel}>
        inside nested template
      </span>
      <slot name='nested'></slot>
    </>
  ),
})
