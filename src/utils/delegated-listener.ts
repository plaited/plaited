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
