import type { StoryObj } from 'plaited/testing'
import { Outer, Slotted, Nested } from './event-dispatch.js'

export const eventDispatch: StoryObj = {
  description: `Example of how to use useDispatch to broadcast events between plaited elements nested within
  another plaited elements shadow dom. When the button in nested-el is clicked the h1 in outer-el shadow dom's
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
}

export const eventDispatchSlot: StoryObj = {
  description: `Example of how to use useDispatch to broadcast events between plaited elements slotted within
another plaited elements light dom. When the button in nested-el is clicked the h1 in parent-el shadow dom has a
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
}
