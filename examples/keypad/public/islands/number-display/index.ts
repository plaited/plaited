/* eslint-disable no-console */
import { Actions, useStore, defineIsland } from '@plaited/island'
import {
  block,
  strand,
  loop,
  waitFor,
  request,
} from '@plaited/behavioral'
import { connect } from '../comms'




defineIsland('number-display', base => class extends base {
  constructor() {
    super()
  }
  connectedCallback(): void {
    super.connectedCallback()
    
  }
})

