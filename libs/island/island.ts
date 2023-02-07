/// <reference lib="dom.iterable" />
import { Trigger } from '../plait/mod.ts'
import { IslandElementConstructor, Query } from './types.ts'
import { controller } from './controller.ts'

/**
 *  Island function
 */
export const island = (
  tag: `${string}-${string}`,
  plait: ($: Query) => {
    trigger: Trigger
    disconnect: () => void
  },
  options?: {
    mode?: 'open' | 'closed'
    delegatesFocus?: boolean
  },
) => {
  if (customElements.get(tag)) return
  class ISLElement extends HTMLElement {
    constructor() {
      super()
    }
  }
  Object.defineProperty(ISLElement.prototype, 'plait', {
    value: plait,
  })
  customElements.define(
    tag,
    controller(ISLElement as IslandElementConstructor, options),
  )
}
