import type { StoryObj } from 'plaited/testing'
import { Template } from './public-events.js'

export const publicEvents: StoryObj = {
  description: `This story is used to validate that the publicEvents parameter
  of defineTemplate allows for triggering a public event on a plaited element`,
  template: Template,
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
}
