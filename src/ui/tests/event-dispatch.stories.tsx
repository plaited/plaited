import { story } from 'plaited/testing'

import { EmitButton, ShadowHost, SlotHost } from './fixtures/event-dispatch.tsx'

export const eventDispatch = story<typeof ShadowHost>({
  description: `Example of how to use useDispatch to broadcast events between Behavioral elements nested within
  another Behavioral elements shadow dom. When the button in nested-el is clicked the h1 in outer-el shadow dom's
  has a string appended to it`,
  template: ShadowHost,
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
    <SlotHost>
      <div>
        <EmitButton />
      </div>
    </SlotHost>
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
