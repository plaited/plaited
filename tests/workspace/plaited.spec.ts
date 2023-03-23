import { Assertion } from '$assert'
import {
  html,
  insertIsland,
  IslandTemplate,
  isle,
  PlaitProps,
  useIndexedDB,
} from '$plaited'
import { symbols } from './constants.ts'
import { connect, send } from './comms.ts'
import { classes, styles } from './test.styles.ts'
export const islandCommsTest = async (t: Assertion) => {
  const island = document.querySelector('calculator-island')
  island?.shadowRoot?.delegatesFocus
  t({
    given: `island SSR'd with default delegateFocus`,
    should: 'delegate focus',
    actual: island?.shadowRoot?.delegatesFocus,
    expected: true,
  })
  // should be an example of a ui and also test worker connection
  let button = await t.findByAttribute('value', '9')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', 'multiply')
  button && await t.fireEvent(button, 'click')
  let target = await t.findByText(`9 ${symbols.multiply}`)
  t({
    given: 'clicking 9 then multiply',
    should: 'render number and operation in previous target',
    actual: target?.dataset.target,
    expected: `previous`,
  })
  button = await t.findByAttribute('value', '1')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', '0')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', 'percent')
  button && await t.fireEvent(button, 'click')
  target = await t.findByText(`0.9`)
  t({
    given: 'clicking 1, 0, then percent',
    should: 'render 10 percent of previous value as current target',
    actual: target?.dataset.target,
    expected: `current`,
  })
  button = await t.findByAttribute('value', 'equal')
  button && await t.fireEvent(button, 'click')
  target = await t.findByText(`9 ${symbols.multiply}  0.9 ${symbols.equal}`)
  t({
    given: 'clicking =',
    should: 'display calculation carried out',
    actual: target?.dataset.target,
    expected: `previous`,
  })
  button = await t.findByAttribute('data-trigger', /click->clear/)
  button && await t.fireEvent(button, 'click')
  let header = await t.findByAttribute('data-target', 'previous')
  t({
    given: 'clicking AC',
    should: 'clear previous header',
    actual: header?.innerHTML,
    expected: ``,
  })
  header = await t.findByAttribute('data-target', 'current')
  t({
    given: 'clicking AC',
    should: '0 current value',
    actual: header?.innerHTML,
    expected: `0`,
  })
  button = await t.findByAttribute('value', '7')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', '3')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', 'subtract')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', '7')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', '0')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', 'add')
  button && await t.fireEvent(button, 'click')
  target = await t.findByText(`3 ${symbols.add}`)
  t({
    given: '73 - 70',
    should: 'display 3 in previous header',
    actual: target?.dataset.target,
    expected: `previous`,
  })
  button = await t.findByAttribute('value', '6')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', 'equal')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('value', 'squareRoot')
  button && await t.fireEvent(button, 'click')
  header = await t.findByAttribute('data-target', 'current')
  t({
    given: 'add 6 then click square root',
    should: 'display 3 in current header',
    actual: header?.innerHTML,
    expected: `3`,
  })
}

export const dynamicIslandCommsTest = async (t: Assertion) => {
  const wrapper = document.getElementById(
    'dynamic-island-comms-test',
  ) as HTMLDetailsElement
  isle(
    {
      tag: 'dynamic-one',
      id: true,
      connect,
    },
    class extends HTMLElement {
      plait({ feedback, $ }: PlaitProps) {
        feedback({
          disable() {
            const [button] = $<HTMLButtonElement>('button')
            button.disabled = true
          },
          click() {
            send('dynamic-two', { event: 'add', detail: { value: ' World!' } })
          },
        })
      }
    },
  ).define()
  isle(
    {
      tag: 'dynamic-two',
      connect,
    },
    class extends HTMLElement {
      plait({ $, feedback, addThreads, thread, sync }: PlaitProps) {
        addThreads({
          onAdd: thread(
            sync({ waitFor: { event: 'add' } }),
            sync({ request: { event: 'disable' } }),
          ),
        })
        feedback({
          disable() {
            send('one', { event: 'disable' })
          },
          add(detail: { value: string }) {
            const [header] = $('header')
            header.insertAdjacentHTML('beforeend', detail.value)
          },
        })
      }
    },
  ).define()
  insertIsland({
    el: wrapper,
    template: IslandTemplate({
      styles,
      id: 'one',
      tag: 'dynamic-one',
      template:
        html`<div class="${classes.row}"><button data-target="button" class="${classes.button}" data-trigger="click->click">Add "world!"</button></div>`,
    }),
  })
  insertIsland({
    el: wrapper,
    template: IslandTemplate({
      styles,
      tag: 'dynamic-two',
      template: html`<h1 data-target="header">Hello</h1>`,
    }),
  })
  let button = await t.findByAttribute('data-target', 'button', wrapper)
  const header = await t.findByAttribute('data-target', 'header', wrapper)
  t({
    given: 'render',
    should: 'header should contain string',
    actual: header?.innerHTML,
    expected: 'Hello',
  })
  button && await t.fireEvent(button, 'click')
  t({
    given: 'clicking button',
    should: 'append string to header',
    actual: header?.innerHTML,
    expected: 'Hello World!',
  })
  button = await t.findByAttribute(
    'data-target',
    'button',
    wrapper,
  )
  t({
    given: 'clicking button',
    should: 'append string to header',
    actual: (button as HTMLButtonElement)?.disabled,
    expected: true,
  })
}

export const slotTest = async (t: Assertion) => {
  const wrapper = document.getElementById('slot-test') as HTMLElement

  insertIsland(
    {
      el: wrapper as HTMLElement,
      template: IslandTemplate({
        styles,
        tag: 'slot-test',
        template: html`<div class="${classes.row}">
          <slot data-trigger="click->slot"></slot>
          <slot name="named" data-trigger="click->named" ></slot>
          <template>
            <div data-target="target">template target</div>
          </template>
          <nested-slot>
            <slot slot="nested" name="nested" data-trigger="click->nested"></slot>
          </nested-slot>
        </div>`,
        slots: html`
          <button>Slot</button>
          <button slot="named">Named</button>
          <button slot="nested">Nested</button>
        `,
      }),
    },
  )
  let slot = 0
  let nested = 0
  let named = 0
  isle(
    { tag: 'slot-test' },
    class extends HTMLElement {
      plait({ feedback }: PlaitProps) {
        feedback({
          slot() {
            slot++
          },
          named() {
            named++
          },
          nested() {
            nested++
          },
        })
      }
    },
  ).define()
  let button = await t.findByText('Slot', wrapper)
  button && await t.fireEvent(button, 'click')
  button = await t.findByText('Named', wrapper)
  button && await t.fireEvent(button, 'click')
  button = await t.findByText('Nested', wrapper)
  button && await t.fireEvent(button, 'click')
  t({
    given: `default slot click of element in event's composed path`,
    should: 'not trigger feedback action',
    actual: slot,
    expected: 0,
  })
  t({
    given: `named slot click of element in event's composed path`,
    should: 'trigger feedback action',
    actual: named,
    expected: 1,
  })
  t({
    given: `nested slot click of element in event's composed path`,
    should: 'not trigger feedback action',
    actual: nested,
    expected: 0,
  })
}
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
export const shadowObserverTest = async (t: Assertion) => {
  const wrapper = document.getElementById(
    'shadow-observer-test',
  ) as HTMLDetailsElement
  let button = await t.findByAttribute(
    'data-trigger',
    'click->start',
    wrapper,
  )
  button && await t.fireEvent(button, 'click')
  let row = await t.findByAttribute('data-target', 'button-row', wrapper)
  t({
    given: 'clicking start',
    should: 'have add button in row',
    actual: row?.children.length,
    expected: 2,
  })
  button && await t.fireEvent(button, 'click')
  row = await t.findByAttribute('data-target', 'button-row', wrapper)
  t({
    given: 'clicking start again',
    should: 'not add another button to row',
    actual: row?.children.length,
    expected: 2,
  })
  send('shadow-island', { event: 'addButton' })
  button = await t.findByText('add svg', wrapper)
  button && await t.fireEvent(button, 'click')
  let zone = await t.findByAttribute('data-target', 'zone', wrapper)
  t({
    given: 'clicking add svg',
    should: 'adds a svg to zone',
    actual: zone?.children.length,
    expected: 1,
  })
  button = await t.findByText('add svg', wrapper)
  button && await t.fireEvent(button, 'click')
  zone = await t.findByAttribute('data-target', 'zone', wrapper)
  const svg = await t.findByAttribute('data-target', 'svg', wrapper)
  t({
    given: 'clicking add svg again',
    should: 'not add another svg to zone',
    actual: zone?.children.length,
    expected: 1,
  })
  t({
    given: 'start action',
    should: 'zone child is an svg',
    actual: svg?.tagName,
    expected: 'svg',
  })
  send('shadow-island', { event: 'removeSvg' })
  button && await t.fireEvent(button, 'click')
  const h3 = await t.findByText('sub island', wrapper)
  t({
    given: 'removing svg',
    should: 'should should still have children',
    actual: zone?.children.length,
    expected: 1,
  })
  t({
    given: 'after svg removal',
    should: 'child should be a h3',
    actual: h3?.tagName,
    expected: 'H3',
  })
}
export const useIndexedDBTest = async (assert: Assertion) => {
  const [get, set] = await useIndexedDB<number>('testKey', 0)
  let actual = await get()
  assert({
    given: 'get',
    should: 'return 0',
    actual,
    expected: 0,
  })
  await set(4)
  actual = await get()
  assert({
    given: 'set with 4',
    should: 'return 4',
    actual,
    expected: 4,
  })
  await set((x) => x + 1)
  actual = await get()
  assert({
    given: 'callback with previous value',
    should: 'return 5',
    actual,
    expected: 5,
  })
  const [get2] = await useIndexedDB('testKey', 1)
  actual = await get2()
  assert({
    given: 'another useIndexedDB with same key but different initial value',
    should: 'return new initial value',
    actual,
    expected: 1,
  })
}
