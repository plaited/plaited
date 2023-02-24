/// <reference lib="dom.iterable" />
import {
  IslandConfig,
  IslandElementConstructor,
  PlaitInterface,
} from './types.ts'
import { controller } from './controller.ts'

/**
 *  Functionally define Island elements
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
  controller(options)(IslandElement as IslandElementConstructor).define(tag)
}
