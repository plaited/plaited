/**
 * Event listener class that implements the EventListener interface for robust event delegation.
 * Provides type-safe event handling and proper Promise handling for async callbacks.
 *
 * @template T - Event type to handle, extends the base Event interface (e.g., MouseEvent, KeyboardEvent)
 *
 * @implements {EventListener}
 *
 * @remarks
 * Key features:
 * - Type-safe event handling with TypeScript
 * - Support for both sync and async callbacks
 * - Proper 'this' binding in event handlers
 * - Compatible with all standard DOM events
 * - Memory-efficient event delegation
 *
 * @example
 * Basic Usage
 * ```ts
 * // Simple click handler
 * const clickListener = new DelegatedListener((e: MouseEvent) => {
 *   console.log('Clicked at:', e.clientX, e.clientY);
 * });
 * element.addEventListener('click', clickListener);
 * ```
 *
 * @example
 * Async Event Handling
 * ```ts
 * // Async form submission handler
 * const submitListener = new DelegatedListener(async (e: SubmitEvent) => {
 *   e.preventDefault();
 *   await submitForm(e.target as HTMLFormElement);
 * });
 * form.addEventListener('submit', submitListener);
 * ```
 *
 * @example
 * Custom Event Handling
 * ```ts
 * // Custom event handler with type checking
 * interface CustomEvent extends Event {
 *   detail: { message: string };
 * }
 *
 * const customListener = new DelegatedListener((e: CustomEvent) => {
 *   console.log(e.detail.message);
 * });
 * element.addEventListener('custom-event', customListener);
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
 * Global WeakMap for storing event delegation relationships between DOM elements.
 * Provides memory-safe storage for event delegation data that automatically
 * cleans up when elements are removed from the DOM.
 *
 * @remarks
 * Implementation details:
 * - Uses WeakMap to prevent memory leaks
 * - Keys are EventTarget instances (elements, documents, windows)
 * - Values can store delegation mappings and handler references
 * - Automatically garbage collects when targets are destroyed
 *
 * @example
 * Internal Usage (for implementation reference)
 * ```ts
 * // Store delegation data
 * delegates.set(element, {
 *   handlers: new Map(),
 *   children: new Set()
 * });
 *
 * // Retrieve delegation data
 * const data = delegates.get(element);
 * if (data) {
 *   // Handle delegation
 * }
 *
 * // Data is automatically cleaned up when element is removed
 * element.remove(); // WeakMap reference is eligible for GC
 * ```
 */
export const delegates = new WeakMap<EventTarget>()
