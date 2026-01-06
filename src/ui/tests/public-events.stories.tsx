import { story } from 'plaited/testing'

import { EventEmitter, EventListener } from './fixtures/public-events.tsx'

const PublicEventsFixture = () => (
  <EventListener>
    <EventEmitter />
  </EventListener>
)

export const publicEventTrigger = story<typeof PublicEventsFixture>({
  intent: `This story is used to validate that the publicEvents parameter
  of bElement allows for triggering a public event on a Behavioral element`,
  template: PublicEventsFixture,
  play: async ({ assert, findByAttribute, fireEvent }) => {
    let button = await findByAttribute('p-target', 'button')
    const header = await findByAttribute('p-target', 'header')
    assert({
      given: 'render',
      should: 'header should contain string',
      actual: header?.innerHTML,
      expected: 'Hello',
    })
    button && (await fireEvent(button, 'click'))
    assert({
      given: 'clicking button',
      should: 'append string to header',
      actual: header?.innerHTML,
      expected: 'Hello World!',
    })
    button = await findByAttribute('p-target', 'button')
    assert({
      given: 'clicking button',
      should: 'be disabled',
      actual: (button as HTMLButtonElement)?.disabled,
      expected: true,
    })
  },
})
