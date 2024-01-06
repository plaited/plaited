import { Component as _Component } from '@plaited/component'
import { PlaitedComponent } from '@plaited/component-types'
import { eventSourceHandler } from './event-source-handler.js'

export const Component: PlaitedComponent = (args) =>
  _Component({
    ...args,
    eventSourceHandler,
  })
