import { Component } from 'plaited'
import { nestedDeclarativeStyles } from './constants.js'

export const RadomComponent = Component({
  tag: 'random-component',
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
