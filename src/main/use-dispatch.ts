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
import type { BPEvent } from './behavioral.types.js'
import { type BehavioralElement } from './b-element.types.js'

/**
 * @internal
 * Type definition for the dispatch function that sends custom events from Behavioral elements.
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
 * Creates a custom event dispatcher for component communication.
 * Enables type-safe event emission across shadow DOM boundaries.
 *
 * @param element - BehavioralElement to dispatch events from
 * @returns Dispatch function for sending custom events
 *
 * @example Parent-child communication
 * ```tsx
 * const ChildComponent = bElement({
 *   tag: 'child-component',
 *   shadowDom: (
 *     <button
 *       p-target="button"
 *       p-trigger={{ click: 'handleClick' }}
 *     >
 *       Notify Parent
 *     </button>
 *   ),
 *   bProgram({ host }) {
 *     const dispatch = useDispatch(host);
 *
 *     return {
 *       handleClick() {
 *         dispatch({
 *           type: 'child-clicked',
 *           detail: { timestamp: Date.now() },
 *           bubbles: true,
 *           composed: true
 *         });
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @example Form validation events
 * ```tsx
 * const FormField = bElement({
 *   tag: 'form-field',
 *   shadowDom: (
 *     <input
 *       p-target="input"
 *       p-trigger={{ blur: 'validate' }}
 *     />
 *   ),
 *   bProgram({ $, host }) {
 *     const [input] = $<HTMLInputElement>('input');
 *     const dispatch = useDispatch(host);
 *
 *     return {
 *       validate() {
 *         const isValid = input.checkValidity();
 *         dispatch({
 *           type: 'field-validated',
 *           detail: { field: input.name, isValid },
 *           bubbles: true
 *         });
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @example State synchronization
 * ```tsx
 * const dispatch = useDispatch(host);
 *
 * // Notify external listeners of state changes
 * dispatch({
 *   type: 'state-changed',
 *   detail: { newState: currentState },
 *   composed: true // Cross shadow boundaries
 * });
 * ```
 *
 * @remarks
 * Default options:
 * - `bubbles: false` - Contained by default
 * - `cancelable: true` - Can be prevented
 * - `composed: true` - Crosses shadow DOM
 *
 * @see {@link BehavioralElement} for element context
 * @see {@link BPEvent} for event structure
 */
export const useDispatch =
  (element: BehavioralElement): Dispatch =>
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
