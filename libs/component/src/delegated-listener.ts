/** https://medium.com/@WebReflection/dom-handleevent-a-cross-platform-standard-since-year-2000-5bf17287fd38 */
export class DelegatedListener {
  callback: (ev: Event) => void | Promise<void>
  constructor(callback: (ev: Event) => void | Promise<void>) {
    this.callback = callback
  }
  handleEvent(evt: Event) {
    void this.callback(evt)
  }
}

export const delegates = new WeakMap()
