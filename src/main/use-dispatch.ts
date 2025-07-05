/**
 * @internal
 * @module use-dispatch
 *
 * Purpose: Type-safe custom event dispatching for cross-component communication
 * Architecture: Wraps native CustomEvent API with sensible defaults for shadow DOM
 * Dependencies: behavioral for BPEvent type, plaited.types for element interface
 * Consumers: Components needing to emit events to parents or external listeners
 *
 * Maintainer Notes:
 * - This module provides the primary outbound communication mechanism for components
 * - Default composed: true is critical for shadow DOM event propagation
 * - Type safety ensures event detail structure matches consumer expectations
 * - No automatic cleanup needed - events are fire-and-forget
 * - Early return on missing type prevents runtime errors
 * - Curried function pattern enables reuse across multiple dispatches
 *
 * Common modification scenarios:
 * - Adding event metadata: Extend BPEvent type or wrap detail
 * - Event logging: Add console.log or telemetry before dispatch
 * - Validation: Check detail structure before creating event
 * - Rate limiting: Add throttling for high-frequency events
 *
 * Performance considerations:
 * - CustomEvent creation is lightweight but has allocation cost
 * - Event propagation through shadow DOM has traversal overhead
 * - No event pooling - each dispatch creates new event object
 * - Consider batching for high-frequency updates
 *
 * Known limitations:
 * - No built-in event deduplication
 * - Cannot track if events are handled
 * - No replay or event sourcing support
 * - Limited to CustomEvent capabilities
 */
import { type BPEvent } from '../behavioral.js'
import { type PlaitedElement } from './plaited.types.js'

/**
 * @internal
 * Type definition for the dispatch function that sends custom events from Plaited elements.
 * Extends BPEvent with CustomEvent options for full control over event behavior.
 *
 * Type intersection combines:
 * - BPEvent: Provides type and detail properties
 * - CustomEvent options: Controls propagation behavior
 */
type Dispatch = (
  args: BPEvent & {
    /** Whether event bubbles up through ancestors (default: false for contained events) */
    bubbles?: boolean
    /** Whether event.preventDefault() can cancel default behavior (default: true) */
    cancelable?: boolean
    /** Whether event crosses shadow DOM boundaries (default: true for component communication) */
    composed?: boolean
  },
) => void

/**
 * Creates an event dispatch function for a Plaited element.
 * Enables component-to-component communication through custom events.
 *
 * @param element - PlaitedElement to dispatch events from
 * @returns A typed dispatch function for creating and sending custom events
 *
 * @example Component communication through shadow DOM boundaries
 * ```tsx
 * const ChildComponent = defineElement({
 *   tag: 'child-component',
 *   shadowDom: (
 *     <button
 *       p-target="button"
 *       p-trigger={{ click: 'handleClick' }}
 *     >
 *       Update Parent
 *     </button>
 *   ),
 *   bProgram({ host }) {
 *     const dispatch = useDispatch(host);
 *
 *     return {
 *       handleClick() {
 *         dispatch({
 *           type: 'update-parent',
 *           detail: { message: 'Hello from child!' },
 *           bubbles: true,
 *           composed: true
 *         });
 *       }
 *     };
 *   }
 * });
 *
 * const ParentComponent = defineElement({
 *   tag: 'parent-component',
 *   publicEvents: ['update-parent']
 *   shadowDom: (
 *     <div>
 *       <p p-target="message">Waiting for update...</p>
 *       <ChildComponent p-trigger={{ 'update-parent': 'handleUpdate' }} />
 *     </div>
 *   ),
 *   bProgram({ $ }) {
 *     const [message] = $('message');
 *
 *     return {
 *       handleUpdate({ detail }) {
 *         message.render(detail.message);
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @example Form validation events
 * ```tsx
 * const FormField = defineElement({
 *   tag: 'form-field',
 *   shadowDom: (
 *     <div>
 *       <input
 *         p-target="input"
 *         p-trigger={{ input: 'validate' }}
 *       />
 *       <span p-target="error"></span>
 *     </div>
 *   ),
 *   bProgram({ $, host }) {
 *     const [input] = $<HTMLInputElement>('input');
 *     const dispatch = useDispatch(host);
 *
 *     return {
 *       validate() {
 *         const isValid = input.value.length >= 3;
 *
 *         dispatch({
 *           type: 'validation-change',
 *           detail: {
 *             field: input.name,
 *             isValid,
 *             value: input.value
 *           },
 *           bubbles: true // Let parent form know
 *         });
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @remarks
 * Default event options:
 * - `bubbles: false` - Events stay within the element by default
 * - `cancelable: true` - Events can be prevented using preventDefault()
 * - `composed: true` - Events cross shadow DOM boundaries by default
 *
 * Common use cases:
 * - Component communication across shadow DOM boundaries
 * - Form validation and state management
 * - Custom event handling in nested components
 * - Parent-child component coordination
 *
 * Best practices:
 * - Use descriptive event types to avoid naming conflicts
 * - Consider event bubbling carefully for nested components
 * - Include relevant data in the detail property
 * - Document public events in component API documentation
 */
export const useDispatch =
  (element: PlaitedElement): Dispatch =>
  /**
   * @internal
   * Returned dispatch function captures element reference in closure.
   * Default parameters optimized for shadow DOM component communication.
   */
  ({ type, detail, bubbles = false, cancelable = true, composed = true }) => {
    /**
     * @internal
     * Guard against missing event type to prevent runtime errors.
     * Silently returns rather than throwing for resilience.
     */
    if (!type) return

    /**
     * @internal
     * Create CustomEvent with provided options.
     * composed: true by default enables cross-shadow-boundary communication.
     * cancelable: true allows preventDefault() for event handling control.
     * bubbles: false by default prevents unintended parent notifications.
     */
    const event = new CustomEvent(type, {
      bubbles,
      cancelable,
      composed,
      detail,
    })

    /**
     * @internal
     * Dispatch event synchronously on the element.
     * Event will propagate according to bubbles/composed settings.
     */
    element.dispatchEvent(event)
  }
