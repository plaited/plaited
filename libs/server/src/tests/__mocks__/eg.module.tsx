import { Component } from 'plaited'
import { nothing } from './constants.js'

export const EgModule = Component({
  tag: 'eg-module',
  template: <slot></slot>,
  bp() {
    nothing
  },
})
