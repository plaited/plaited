/// <reference lib="dom.iterable" />
import {
  IslandConfig,
  IslandElementConstructor,
  PlaitInterface,
} from './types.ts'
import { controller } from './controller.ts'

/**
 *  Island function
 */
export const define = (
  { tag, ...options }: IslandConfig,
  plait: PlaitInterface,
) => {
  class IslandElement extends HTMLElement {
    constructor() {
      super()
    }
  }
  Object.defineProperty(IslandElement.prototype, 'plait', {
    value: plait,
  })
  controller(IslandElement as IslandElementConstructor, options).define(tag)
}
