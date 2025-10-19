/**
 * Type-safe event listener class for DOM event delegation.
 * Supports sync/async callbacks with proper typing.
 *
 * @template T - Event type (MouseEvent, KeyboardEvent, etc.)
 * @implements {EventListener}
 *
 * @example Click handler
 * ```ts
 * const listener = new DelegatedListener((e: MouseEvent) => {
 *   console.log('Clicked at:', e.clientX, e.clientY);
 * });
 * element.addEventListener('click', listener);
 * ```
 *
 * @example Async handler
 * ```ts
 * const submit = new DelegatedListener(async (e: SubmitEvent) => {
 *   e.preventDefault();
 *   await submitForm(e.target as HTMLFormElement);
 * });
 * form.addEventListener('submit', submit);
 * ```
 *
 * @example Custom events
 * ```ts
 * type CustomEvent = Event & { detail: { message: string } };
 * const custom = new DelegatedListener((e: CustomEvent) => {
 *   console.log(e.detail.message);
 * });
 * ```
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
