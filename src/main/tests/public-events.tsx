/**
 * Demonstrates how to expose and handle public events in Plaited components.
 * Shows the interaction between parent and child components through event handling
 * and state management.
 *
 * Features:
 * - Public event declaration
 * - Event bubbling control
 * - Parent-child communication
 * - State synchronization
 * - Element attribute management
 *
 * @example
 * ```tsx
 * // Child component with public events
 * const Child = defineElement({
 *   tag: 'my-child',
 *   publicEvents: ['statusChange'],
 *   shadowDom: (
 *     <button p-trigger={{ click: 'toggleStatus' }}>
 *       Toggle
 *     </button>
 *   ),
 *   bProgram({ host }) {
 *     const dispatch = useDispatch(host);
 *     return {
 *       toggleStatus() {
 *         dispatch({
 *           type: 'statusChange',
 *           detail: { active: true }
 *         });
 *       }
 *     };
 *   }
 * });
 *
 * // Parent handling child events
 * const Parent = defineElement({
 *   tag: 'my-parent',
 *   shadowDom: (
 *     <Child p-trigger={{
 *       statusChange: 'handleStatus'
 *     }} />
 *   ),
 *   bProgram({ $ }) {
 *     return {
 *       handleStatus({ detail }) {
 *         console.log('Status changed:', detail.active);
 *       }
 *     };
 *   }
 * });
 * ```
 */

import { type FT, defineElement, useDispatch, isPlaitedElement } from 'plaited'

const getPlaitedChildren = (slot: HTMLSlotElement) => [...slot.assignedElements()].filter(isPlaitedElement)

const Inner = defineElement({
  tag: 'inner-component',
  shadowDom: <h1 p-target='header'>Hello</h1>,
  publicEvents: ['add'],
  bProgram({ $, bThreads, bThread, bSync, host }) {
    const dispatch = useDispatch(host)
    bThreads.set({
      onAdd: bThread([bSync({ waitFor: 'add' }), bSync({ request: { type: 'disable' } })]),
    })
    return {
      disable() {
        dispatch({ type: 'disable', bubbles: true })
      },
      add(detail: string) {
        const [header] = $('header')
        header.insert('beforeend', <>{detail}</>)
      },
    }
  },
})

const Outer = defineElement({
  tag: 'outer-component',
  shadowDom: (
    <div>
      <slot
        p-target='slot'
        p-trigger={{ disable: 'disable' }}
      ></slot>
      <button
        p-target='button'
        p-trigger={{ click: 'click' }}
      >
        Add "world!"
      </button>
    </div>
  ),
  bProgram({ $ }) {
    return {
      disable() {
        const [button] = $<HTMLButtonElement>('button')
        button && (button.disabled = true)
      },
      click() {
        const [slot] = $<HTMLSlotElement>('slot')
        const [el] = getPlaitedChildren(slot)
        el.trigger({ type: 'add', detail: ' World!' })
      },
    }
  },
})

export const Template: FT = () => (
  <Outer>
    <Inner />
  </Outer>
)
