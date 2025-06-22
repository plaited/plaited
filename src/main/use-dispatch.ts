import { type BPEvent } from '../behavioral.js'
import { type PlaitedElement } from './plaited.types.js'

/**
 * Type definition for the dispatch function that sends custom events from Plaited elements.
 * Provides type-safe event dispatching with CustomEvent initialization options.
 *
 * @template T - The type of data to be included in the event's detail property
 * @param args - Event configuration object containing:
 *   - type: The event type/name
 *   - detail: Event-specific data (optional)
 *   - bubbles: Whether the event bubbles up through the DOM tree (default: false)
 *   - cancelable: Whether the event can be canceled (default: true)
 *   - composed: Whether the event crosses shadow DOM boundaries (default: true)
 */
type Dispatch = <T = unknown>(
  args: BPEvent<T> & {
    bubbles?: boolean
    cancelable?: boolean
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
