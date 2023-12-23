/** https://medium.com/@WebReflection/dom-handleevent-a-cross-platform-standard-since-year-2000-5bf17287fd38 */
class DelegatedListener {
  callback: (ev: Event) => void
  constructor(callback: (ev: Event) => void) {
    this.callback = callback
  }
  handleEvent(evt: Event) {
    this.callback(evt)
  }
}

const delegates = new WeakMap()

export const delegatedListener = Object.freeze({
  set: (context: Element, callback: (ev: Event) => void) => {
    delegates.set(context, new DelegatedListener(callback))
  },
  get: (context: Element) => delegates.get(context),
  has: (context: Element) => delegates.has(context),
})