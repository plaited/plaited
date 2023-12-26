import { isTypeOf } from '@plaited/utils'
import { PlaitedElementConstructor, PlaitedElement, Emit } from '@plaited/component-types'

export const defineRegistry = (registry: Set<PlaitedElementConstructor>, silent = false) => {
  for (const el of registry) {
    const elTag = el.tag
    if (customElements.get(elTag)) {
      !silent && console.error(`${elTag} already defined`)
      continue
    }
    customElements.define(elTag, el)
  }
}

/** @description utility function to check if Element is Plaited Component */
export const isPlaited = (el: Element): el is PlaitedElement =>
  isTypeOf<PlaitedElement>(el, 'htmlelement') && 'trigger' in el

/** @description emit a custom event cancelable and composed are true by default */
export const emit =
  (host: HTMLElement) =>
  ({ type, detail, bubbles = false, cancelable = true, composed = true }: Parameters<Emit>[0]) => {
    if (!type) return
    const event = new CustomEvent(type, {
      bubbles,
      cancelable,
      composed,
      detail,
    })
    host.dispatchEvent(event)
  }

/** https://medium.com/@WebReflection/dom-handleevent-a-cross-platform-standard-since-year-2000-5bf17287fd38 */
export class DelegatedListener<T extends Event = Event> {
  callback: (ev: T) => void | Promise<void>
  constructor(callback: (ev: T) => void | Promise<void>) {
    this.callback = callback
  }
  handleEvent(evt: T) {
    void this.callback(evt)
  }
}

export const delegates = new WeakMap<EventTarget>()
