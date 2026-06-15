/**
 * EventListener adapter for delegated controller callbacks.
 *
 * @template T - Event type (MouseEvent, KeyboardEvent, etc.)
 * @implements {EventListener}
 *
 * @remarks
 * Wraps sync or async callbacks in an object accepted by native
 * `addEventListener`. Controller islands use it for `o-trigger` bindings and
 * imported modules can reuse it for their own delegated DOM listeners.
 *
 * @see {@link delegates} for the WeakMap storage
 *
 * @public
 */
export class DelegatedListener<T extends Event = Event> {
  callback: (ev: T) => void | Promise<void>
  constructor(callback: (ev: T) => void | Promise<void>) {
    this.callback = callback
  }
  handleEvent(evt: T) {
    void this.callback(evt)
  }
}
