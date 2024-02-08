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
