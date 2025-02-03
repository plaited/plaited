import { type BPEvent } from '../behavioral/b-thread.js'
import { type PlaitedElement } from './plaited.types.js'

type Dispatch = <T = unknown>(
  args: BPEvent<T> & {
    bubbles?: boolean
    cancelable?: boolean
    composed?: boolean
  },
) => void

/**
 * Creates an event dispatch function for a Plaited element.
 * Provides type-safe custom event dispatching with default options.
 *
 * @param element PlaitedElement to dispatch events from
 * @returns Typed dispatch function for creating and sending custom events
 *
 * @example
 * // Basic usage
 * const dispatch = useDispatch(element);
 * dispatch({
 *   type: 'custom-event',
 *   detail: { data: 'value' }
 * });
 *
 * @example
 * // With custom options
 * dispatch({
 *   type: 'bubble-event',
 *   detail: { data: 'value' },
 *   bubbles: true,
 *   composed: false
 * });
 *
 * @remarks
 * Default options:
 * - bubbles: false (events don't bubble)
 * - cancelable: true (events can be canceled)
 * - composed: true (events cross shadow DOM boundaries)
 *
 */
export const useDispatch =
  (element: PlaitedElement): Dispatch =>
  ({ type, detail, bubbles = false, cancelable = true, composed = true }) => {
    if (!type) return
    const event = new CustomEvent(type, {
      bubbles,
      cancelable,
      composed,
      detail,
    })
    element.dispatchEvent(event)
  }
