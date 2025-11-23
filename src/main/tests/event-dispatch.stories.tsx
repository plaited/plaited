import { bElement, useDispatch } from 'plaited'
import { story } from 'plaited/testing'

const Nested = bElement({
  tag: 'nested-el',
  shadowDom: (
    <button
      type='button'
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

const Outer = bElement({
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
        header?.insert('beforeend', <> World!</>)
      },
    }
  },
})

const Slotted = bElement({
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
        header?.insert('beforeend', <> World!</>)
      },
    }
  },
})

export const eventDispatch = story<typeof Outer>({
  description: `Example of how to use useDispatch to broadcast events between Behavioral elements nested within
  another Behavioral elements shadow dom. When the button in nested-el is clicked the h1 in outer-el shadow dom's
  has a string appended to it`,
  template: Outer,
  play: async ({ assert, findByAttribute, fireEvent }) => {
    const button = await findByAttribute('p-target', 'button')
    const header = await findByAttribute('p-target', 'header')
    assert({
      given: 'render',
      should: 'header should contain string',
      actual: header?.textContent,
      expected: 'Hello',
    })
    button && (await fireEvent(button, 'click'))
    assert({
      given: 'clicking button',
      should: 'append string to header',
      actual: header?.textContent,
      expected: 'Hello World!',
    })
  },
})

export const eventDispatchSlot = story({
  description: `Example of how to use useDispatch to broadcast events between Behavioral elements slotted within
another Behavioral elements light dom. When the button in nested-el is clicked the h1 in parent-el shadow dom has a
string appended to it`,
  template: () => (
    <Slotted>
      <div>
        <Nested />
      </div>
    </Slotted>
  ),
  play: async ({ assert, findByAttribute, fireEvent }) => {
    const button = await findByAttribute('p-target', 'button')
    const header = await findByAttribute('p-target', 'header')
    assert({
      given: 'render',
      should: 'header should contain string',
      actual: header?.textContent,
      expected: 'Hello',
    })
    button && (await fireEvent(button, 'click'))
    assert({
      given: 'clicking button',
      should: 'append string to header',
      actual: header?.textContent,
      expected: 'Hello World!',
    })
  },
})
