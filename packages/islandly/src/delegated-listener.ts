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
  set: (context: Node, callback: (ev: Event) => void) => {
    delegates.set(context, new DelegatedListener(callback))
  },
  get: (context: Node) => delegates.get(context),
  has: (context: Node) => delegates.has(context),
})
