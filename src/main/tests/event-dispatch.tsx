import { defineElement, useDispatch } from 'plaited'

/**
 * Demonstrates event dispatching and handling between nested Plaited components
 * using the useDispatch utility. Shows how to propagate events through Shadow DOM
 * boundaries and handle them at different levels.
 *
 * Features:
 * - Cross-boundary event propagation
 * - Event bubbling control
 * - Shadow DOM event handling
 * - Slotted content event management
 *
 * @example
 * ```tsx
 * // Child component that dispatches events
 * const Child = defineElement({
 *   tag: 'my-child',
 *   shadowDom: (
 *     <button p-trigger={{ click: 'notify' }}>
 *       Notify Parent
 *     </button>
 *   ),
 *   bProgram({ host }) {
 *     const dispatch = useDispatch(host);
 *     return {
 *       notify() {
 *         dispatch({
 *           type: 'notification',
 *           bubbles: true,
 *           composed: true,
 *           detail: { message: 'Hello!' }
 *         });
 *       }
 *     };
 *   }
 * });
 *
 * // Parent component that handles events
 * const Parent = defineElement({
 *   tag: 'my-parent',
 *   shadowDom: (
 *     <div>
 *       <Child p-trigger={{ notification: 'handleNotification' }} />
 *       <div p-target="output" />
 *     </div>
 *   ),
 *   bProgram({ $ }) {
 *     return {
 *       handleNotification({ detail }) {
 *         $('output')[0].render(detail.message);
 *       }
 *     };
 *   }
 * });
 * ```
 */

export const Nested = defineElement({
  tag: 'nested-el',
  shadowDom: (
    <button
      p-target='button'
      p-trigger={{ click: 'click' }}
    >
      Add
    </button>
  ),
  publicEvents: ['add'],
  bProgram({ host }) {
    const dispatch = useDispatch(host)
    return {
      click() {
        dispatch({ type: 'append', bubbles: true, composed: true })
      },
    }
  },
})

export const Outer = defineElement({
  tag: 'outer-el',
  shadowDom: (
    <div>
      <h1 p-target='header'>Hello</h1>
      <Nested p-trigger={{ append: 'append' }}></Nested>
    </div>
  ),
  bProgram({ $ }) {
    return {
      append() {
        const [header] = $('header')
        header.insert('beforeend', <> World!</>)
      },
    }
  },
})

export const Slotted = defineElement({
  tag: 'parent-el',
  shadowDom: (
    <div>
      <h1 p-target='header'>Hello</h1>
      <slot p-trigger={{ append: 'append' }}></slot>
    </div>
  ),
  bProgram({ $ }) {
    return {
      append() {
        const [header] = $('header')
        header.insert('beforeend', <> World!</>)
      },
    }
  },
})
