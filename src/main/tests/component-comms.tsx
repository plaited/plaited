/**
 * Demonstrates inter-component communication using Plaited's useSignal pattern.
 * Shows how to implement a decoupled pub/sub communication between components
 * without direct parent-child relationships.
 *
 * Pattern Features:
 * - Shared state management with useSignal
 * - Event-driven communication
 * - Automatic cleanup with disconnect
 * - Type-safe message passing
 *
 * @example
 * ```tsx
 * // Create a shared signal
 * const messageSignal = useSignal<string>();
 *
 * // Publisher component
 * const Publisher = defineElement({
 *   tag: 'my-publisher',
 *   shadowDom: (
 *     <button p-trigger={{ click: 'send' }}>
 *       Send Message
 *     </button>
 *   ),
 *   bProgram() {
 *     return {
 *       send() {
 *         messageSignal.set("Hello!");
 *       }
 *     };
 *   }
 * });
 *
 * // Subscriber component
 * const Subscriber = defineElement({
 *   tag: 'my-subscriber',
 *   shadowDom: <div p-target="output" />,
 *   bProgram({ $, trigger }) {
 *     messageSignal.listen('message', trigger);
 *     return {
 *       message(msg: string) {
 *         $('output')[0].render(msg);
 *       }
 *     };
 *   }
 * });
 * ```
 */

import { defineElement, type FT, useSignal } from 'plaited'

const sendDisable = useSignal()
const sendAdd = useSignal<{ value: string }>()

export const ElOne = defineElement({
  tag: 'elemenmt-one',
  publicEvents: ['disable'],
  shadowDom: (
    <div>
      <button
        p-target='button'
        p-trigger={{ click: 'click' }}
      >
        Add "world!"
      </button>
    </div>
  ),
  bProgram({ $, trigger }) {
    const disconnect = sendDisable.listen('disable', trigger)
    return {
      disable() {
        const [button] = $<HTMLButtonElement>('button')
        button && button.attr('disabled', true)
        disconnect()
      },
      click() {
        sendAdd.set({ value: ' World!' })
      },
    }
  },
})

export const ElTwo = defineElement({
  tag: 'element-two',
  publicEvents: ['add'],
  shadowDom: <h1 p-target='header'>Hello</h1>,
  bProgram({ $, bThread, bThreads, bSync, trigger }) {
    sendAdd.listen('add', trigger)
    bThreads.set({
      onAdd: bThread([bSync({ waitFor: 'add' }), bSync({ request: { type: 'disable' } })]),
    })
    return {
      disable() {
        sendDisable.set()
      },
      add(detail: { value: string }) {
        const [header] = $('header')
        header.insert('beforeend', <>{detail.value}</>)
      },
    }
  },
})

export const ComponentComms: FT = () => {
  return (
    <>
      <ElOne />
      <ElTwo />
    </>
  )
}
