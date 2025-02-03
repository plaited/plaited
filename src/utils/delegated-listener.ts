/**
 * Class that implements the EventListener interface for delegated event handling.
 * Wraps callback functions to handle events in a consistent way with proper typing.
 *
 * @template T Type of Event to be handled, defaults to base Event
 *
 * @example
 * const listener = new DelegatedListener((e: MouseEvent) => {
 *   console.log('Mouse position:', e.clientX, e.clientY)
 * });
 * element.addEventListener('click', listener);
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
 * WeakMap storing event delegation relationships between EventTargets.
 * Uses weak references to allow garbage collection of unused event targets.
 *
 * @remarks
 * - Keys are EventTarget instances (elements, documents, windows)
 * - Values are implementation-specific delegation data
 * - Automatically cleans up when targets are no longer referenced
 */
export const delegates = new WeakMap<EventTarget>()
