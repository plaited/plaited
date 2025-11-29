/**
 * @internal
 * @module use-emit
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

import type { BehavioralElement } from './b-element.types.ts'
import type { BPEvent } from './behavioral.types.ts'

/**
 * @internal
 * Type definition for the dispatch function that sends custom events from Behavioral elements.
 * Extends BPEvent with CustomEvent options for full control over event behavior.
 *
 * Type intersection combines:
 * - BPEvent: Provides type and detail properties
 * - CustomEvent options: Controls propagation behavior
 */
export type Emit = (
  args: BPEvent & {
    /** Whether event bubbles up through ancestors (default: false for contained events) */
    bubbles?: boolean
    /** Whether event.preventDefault() can cancel default behavior (default: true) */
    cancelable?: boolean
    /** Whether event crosses shadow DOM boundaries (default: true for component communication) */
    composed?: boolean
  },
) => boolean

export class EmitTypeError extends Error implements Error {
  override name = 'emit_type'
}

/**
 * Creates a custom event dispatcher for component communication.
 * Enables type-safe event emission across shadow DOM boundaries.
 *
 * @param element - BehavioralElement to dispatch events from
 * @returns Emit function for sending custom events
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
export const useEmit =
  (element: BehavioralElement): Emit =>
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
    if (!type) throw new EmitTypeError('Event type is required')

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
    return element.dispatchEvent(event)
  }
