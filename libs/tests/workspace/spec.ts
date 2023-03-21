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
// import { fireEvent, screen } from './deps.ts'

export const islandCommsTest = async (t: Assertion) => {
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

export const slotTest = async (t: Assertion) => {
  const wrapper = document.getElementById('slot-test')
  insertIsland(
    {
      el: wrapper as HTMLElement,
      island: IslandTemplate({
        tag: 'slot-test',
        template: html`
    <slot></slot>
    <slot name="named"></slot>
    <template>
      <div data-target="target">template target</div>
    </template>
    <nested-slot>
      <slot slot="nested" name="nested"></slot>
    </nested-slot>
    `,
        slots: html`
      <button data-trigger="click->slot">Slot</button>
      <button data-trigger="click->named" slot="named">Named</button>
      <button data-trigger="click->nested" slot="nested">Nested</button>
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
  let button = await t.findByAttribute('data-trigger', 'click->slot')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('data-trigger', 'click->named')
  button && await t.fireEvent(button, 'click')
  button = await t.findByAttribute('data-trigger', 'click->nested')
  button && await t.fireEvent(button, 'click')
  t({
    given: 'default slot click',
    should: 'not trigger feedback action',
    actual: slot,
    expected: 0,
  })
  t({
    given: 'named slot click',
    should: 'trigger feedback action',
    actual: named,
    expected: 1,
  })
  t({
    given: 'nested slot click',
    should: 'not trigger feedback action',
    actual: nested,
    expected: 0,
  })
}
export const templateObserverTest = async (t: Assertion) => {
  const wrapper = document.getElementById('template-observer-test')
  const island = document.createElement('template-test')
  wrapper?.insertAdjacentElement('beforeend', island)
  const template = document.createElement('template')
  template.innerHTML = html`<div>template content</div>`
  template.setAttribute('shadowrootmode', 'open')
  isle(
    { tag: 'template-test' },
    class extends HTMLElement {
      plait({ context }: PlaitProps) {
        context.append(template)
      }
    },
  ).define()
  await t.wait(60)
  t({
    given: 'appending template in connected callback',
    should: 'no longer be in light dom',
    actual: island?.innerHTML,
    expected: '',
  })
  t({
    given: 'appending template in connected callback',
    should: 'no longer be in light dom',
    actual: island?.shadowRoot?.innerHTML,
    expected: html`<div>template content</div>`,
  })
}
export const shadowObserverTest = () => {
  // const wrapper = document.getElementById('template-observer-test')
  // need to test adding nodes without attributes
  // need to test modifying attributes on node
  // need to test adding slot element to this
  // need to test adding svg with attribute to this.
  isle(
    { tag: 'shadow-test' },
    class extends HTMLElement {
      plait({ feedback }: PlaitProps) {
        // const root = context.shadowRoot as ShadowRoot
        feedback({
          addNodes() {
          },
          modifyAttributes() {
          },
          addSlot() {
          },
          addSvg() {
          },
        })
      }
    },
  ).define()
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
