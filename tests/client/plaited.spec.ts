import { Assertion } from '$assert'
import {
  html,
  IslandTemplate,
  isle,
  PlaitProps,
  render,
  useIndexedDB,
} from '$plaited'
import { symbols } from './constants.ts'
import { connect, send } from './comms.ts'
import { classes, styles } from './test.styles.ts'

// export const dynamicIslandCommsTest = async (t: Assertion) => {
//   const wrapper = document.getElementById(
//     'dynamic-island-comms-test',
//   ) as HTMLDetailsElement
//   isle(
//     {
//       tag: 'dynamic-one',
//       id: true,
//       connect,
//     },
//     class extends HTMLElement {
//       plait({ feedback, $ }: PlaitProps) {
//         feedback({
//           disable() {
//             const [button] = $<HTMLButtonElement>('button')
//             button.disabled = true
//           },
//           click() {
//             send('dynamic-two', { type: 'add', detail: { value: ' World!' } })
//           },
//         })
//       }
//     },
//   ).define()
//   isle(
//     {
//       tag: 'dynamic-two',
//       connect,
//     },
//     class extends HTMLElement {
//       plait({ $, feedback, addThreads, thread, sync }: PlaitProps) {
//         addThreads({
//           onAdd: thread(
//             sync({ waitFor: { type: 'add' } }),
//             sync({ request: { type: 'disable' } }),
//           ),
//         })
//         feedback({
//           disable() {
//             send('one', { type: 'disable' })
//           },
//           add(detail: { value: string }) {
//             const [header] = $('header')
//             render(header, `${detail.value}`, 'beforeend')
//           },
//         })
//       }
//     },
//   ).define()

//   render(
//     wrapper,
//     html`${[
//       IslandTemplate({
//         styles,
//         id: 'one',
//         tag: 'dynamic-one',
//         template:
//           html`<div class="${classes.row}"><button data-target="button" class="${classes.button}" data-trigger="click->click">Add "world!"</button></div>`,
//       }),
//       IslandTemplate({
//         styles,
//         tag: 'dynamic-two',
//         template: html`<h1 data-target="header">Hello </h1>`,
//       }),
//     ]}`,
//     'beforeend',
//   )
//   let button = await t.findByAttribute('data-target', 'button', wrapper)
//   const header = await t.findByAttribute('data-target', 'header', wrapper)
//   t({
//     given: 'render',
//     should: 'header should contain string',
//     actual: header?.innerHTML,
//     expected: 'Hello',
//   })
//   button && await t.fireEvent(button, 'click')
//   t({
//     given: 'clicking button',
//     should: 'append string to header',
//     actual: header?.innerHTML,
//     expected: 'Hello World!',
//   })
//   button = await t.findByAttribute(
//     'data-target',
//     'button',
//     wrapper,
//   )
//   t({
//     given: 'clicking button',
//     should: 'be disabled',
//     actual: (button as HTMLButtonElement)?.disabled,
//     expected: true,
//   })
// }

// export const slotTest = async (t: Assertion) => {
//   const wrapper = document.getElementById('slot-test') as HTMLElement

//   render(
//     wrapper,
//     IslandTemplate({
//       styles,
//       tag: 'slot-test',
//       template: html`<div class="${classes.row}">
//         <slot data-trigger="click->slot"></slot>
//         <slot name="named" data-trigger="click->named" ></slot>
//         <template>
//           <div data-target="target">template target</div>
//         </template>
//         <nested-slot>
//           <slot slot="nested" name="nested" data-trigger="click->nested"></slot>
//         </nested-slot>
//       </div>`,
//       slots: html`
//         <button>Slot</button>
//         <button slot="named">Named</button>
//         <button slot="nested">Nested</button>
//       `,
//     }),
//     'beforeend',
//   )
//   let slot = 0
//   let nested = 0
//   let named = 0
//   isle(
//     { tag: 'slot-test' },
//     class extends HTMLElement {
//       plait({ feedback }: PlaitProps) {
//         feedback({
//           slot() {
//             slot++
//           },
//           named() {
//             named++
//           },
//           nested() {
//             nested++
//           },
//         })
//       }
//     },
//   ).define()
//   let button = await t.findByText('Slot', wrapper)
//   button && await t.fireEvent(button, 'click')
//   button = await t.findByText('Named', wrapper)
//   button && await t.fireEvent(button, 'click')
//   button = await t.findByText('Nested', wrapper)
//   button && await t.fireEvent(button, 'click')
//   t({
//     given: `default slot click of element in event's composed path`,
//     should: 'not trigger feedback action',
//     actual: slot,
//     expected: 0,
//   })
//   t({
//     given: `named slot click of element in event's composed path`,
//     should: 'trigger feedback action',
//     actual: named,
//     expected: 1,
//   })
//   t({
//     given: `nested slot click of element in event's composed path`,
//     should: 'not trigger feedback action',
//     actual: nested,
//     expected: 0,
//   })
// }
export const templateObserverTest = async (t: Assertion) => {
  const wrapper = document.getElementById(
    'template-observer-test',
  ) as HTMLDetailsElement
  const el = document.createElement('template-test')
  el.setAttribute('data-test-id', 'island')
  wrapper?.insertAdjacentElement('beforeend', el)
  const template = document.createElement('template')
  template.innerHTML = html`<h2>template content</h2>`
  template.setAttribute('shadowrootmode', 'open')
  let island = await t.findByAttribute('data-test-id', 'island', wrapper)
  isle(
    { tag: 'template-test' },
    class extends HTMLElement {
      plait() {
        island?.append(template)
        t({
          given: 'before being observed by template observer',
          should: 'still be in light dom',
          actual: island?.innerHTML,
          expected:
            html`<template shadowrootmode="open"><h2>template content</h2></template>`,
        })
      }
    },
  ).define()
  island = await t.findByAttribute('data-test-id', 'island', wrapper)
  t({
    given: 'after template append is observed by observer',
    should: 'no longer be in light dom',
    actual: island?.innerHTML,
    expected: '',
  })
  t({
    given: 'appending template in connected callback',
    should: 'should now be in shadow dom',
    actual: island?.shadowRoot?.innerHTML,
    expected: html`<h2>template content</h2>`,
  })
}
//
// export const useIndexedDBTest = async (assert: Assertion) => {
//   const [get, set] = await useIndexedDB<number>('testKey', 0)
//   let actual = await get()
//   assert({
//     given: 'get',
//     should: 'return 0',
//     actual,
//     expected: 0,
//   })
//   await set(4)
//   actual = await get()
//   assert({
//     given: 'set with 4',
//     should: 'return 4',
//     actual,
//     expected: 4,
//   })
//   await set((x) => x + 1)
//   actual = await get()
//   assert({
//     given: 'callback with previous value',
//     should: 'return 5',
//     actual,
//     expected: 5,
//   })
//   const [get2] = await useIndexedDB('testKey', 1)
//   actual = await get2()
//   assert({
//     given: 'another useIndexedDB with same key but different initial value',
//     should: 'return new initial value',
//     actual,
//     expected: 1,
//   })
// }
