/// <reference lib="dom.iterable" />
import { IslandConfig, IslandElementConstructor, ISLElement } from './types.ts'
import { controller } from './controller.ts'

/**
 *  Functionally define Island elements
 */
export const define = (
  { tag, ...options }: IslandConfig,
  plait: ISLElement['plait'],
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
