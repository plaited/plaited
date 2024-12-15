import type { StoryObj } from 'plaited/test'
import { Outer, Slotted, Nested } from './event-dispatch.js'

export const eventDispatch: StoryObj = {
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
