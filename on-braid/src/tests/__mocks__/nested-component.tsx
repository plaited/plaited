import { Component } from 'plaited'
import { nestedDeclarativeStyles } from './constants.js'

export const NestedCustomElement = Component({
  tag: 'nested-component',
  template: (
    <>
      <span
        className={nestedDeclarativeStyles['nested-label']}
        stylesheet={nestedDeclarativeStyles.$stylesheet}
      >
        inside nested template
      </span>
      <slot name='nested'></slot>
    </>
  ),
})
