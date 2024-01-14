import { Component } from 'plaited'
import { nothing } from './constants.js'

export const EgModuleTwo = Component({
  tag: 'eg-module-two',
  template: <slot></slot>,
  bp() {
    nothing
  },
})
