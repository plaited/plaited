/**
 * Demonstrates state management using Plaited's useSignal hook.
 * Shows publisher-subscriber pattern for component communication.
 *
 * Features:
 * - Centralized state management
 * - Type-safe state updates
 * - Automatic subscription cleanup
 * - Cross-component synchronization
 *
 * @example
 * ```tsx
 * // Create a shared counter signal
 * const counterSignal = useSignal(0);
 *
 * // Counter display component
 * const Counter = defineElement({
 *   tag: 'my-counter',
 *   shadowDom: <div p-target="display">{counterSignal.get()}</div>,
 *   bProgram({ $, trigger }) {
 *     counterSignal.listen('update', trigger);
 *     return {
 *       update(count: number) {
 *         $('display')[0].render(`Count: ${count}`);
 *       }
 *     };
 *   }
 * });
 *
 * // Button component that updates counter
 * const Button = defineElement({
 *   tag: 'counter-button',
 *   shadowDom: (
 *     <button p-trigger={{ click: 'increment' }}>
 *       Increment
 *     </button>
 *   ),
 *   bProgram() {
 *     return {
 *       increment() {
 *         counterSignal.set(counterSignal.get() + 1);
 *       }
 *     };
 *   }
 * });
 * ```
 */

import { type FT, defineElement, useSignal } from 'plaited'

const store = useSignal<number>(0)

const Publisher = defineElement({
  tag: 'publisher-component',
  shadowDom: (
    <button
      p-trigger={{ click: 'increment' }}
      p-target='button'
    >
      increment
    </button>
  ),
  publicEvents: ['add'],
  bProgram({ bThreads, bThread, bSync }) {
    bThreads.set({
      onAdd: bThread([bSync({ waitFor: 'add' }), bSync({ request: { type: 'disable' } })]),
    })
    return {
      increment() {
        store.set(store.get() + 1)
      },
    }
  },
})

const Subscriber = defineElement({
  tag: 'subscriber-component',
  shadowDom: <h1 p-target='count'>{store.get()}</h1>,
  publicEvents: ['update'],
  bProgram({ $, trigger }) {
    store.listen('update', trigger)
    return {
      update(value: number) {
        const [count] = $('count')
        count.render(`${value}`)
      },
    }
  },
})

export const Fixture: FT = () => (
  <>
    <Publisher />
    <Subscriber />
  </>
)
