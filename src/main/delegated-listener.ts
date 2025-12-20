/**
 * Type-safe event listener class for DOM event delegation.
 * Supports sync/async callbacks with proper typing.
 *
 * @template T - Event type (MouseEvent, KeyboardEvent, etc.)
 * @implements {EventListener}
 *
 * @remarks
 * - Implements EventListener interface for native DOM compatibility
 * - Supports both synchronous and asynchronous event handlers
 * - Type-safe event handling with TypeScript generics
 * - Used internally by bElement for p-trigger event delegation
 *
 * @see {@link delegates} for the WeakMap storage
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

/**
 * @internal
 * WeakMap for event delegation data.
 * Auto-cleans when elements are removed.
 */
export const delegates = new WeakMap<EventTarget>()
