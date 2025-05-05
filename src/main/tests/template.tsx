/**
 * Demonstrates different Shadow DOM initialization options in Plaited components.
 * Shows how to configure shadow root mode and focus delegation behavior.
 *
 * Features:
 * - Shadow DOM mode configuration (open/closed)
 * - Focus delegation control
 * - Element initialization patterns
 * - Shadow root accessibility options
 *
 * @example
 * ```tsx
 * // Open shadow root with focus delegation (default)
 * const DefaultElement = defineElement({
 *   tag: 'my-element',
 *   shadowDom: <button>Click me</button>
 * });
 *
 * // Closed shadow root
 * const PrivateElement = defineElement({
 *   tag: 'private-element',
 *   mode: 'closed',
 *   shadowDom: <div>Private content</div>
 * });
 *
 * // Disable focus delegation
 * const NoFocusElement = defineElement({
 *   tag: 'no-focus-element',
 *   delegatesFocus: false,
 *   shadowDom: <input type="text" />
 * });
 * ```
 */

import { defineElement } from 'plaited'

export const DelegateFalse = defineElement({
  tag: 'delegate-false',
  delegatesFocus: false,
  shadowDom: <span>mode open and delegates focus</span>,
})

export const ModeOpen = defineElement({
  tag: 'mode-open',
  shadowDom: <span>mode open and delegates focus</span>,
})

export const ClosedMode = defineElement({
  tag: 'mode-closed',
  mode: 'closed',
  shadowDom: <span>mode open and delegates focus</span>,
})
