import { type StoryObj } from 'plaited/testing'
import { ComponentComms } from './component-comms.js'

export const componentComms: StoryObj = {
  template: ComponentComms,
  description: `Example of how to use useSignal to enable communication between
  plaited elements. This story is used to validate that when the button in element-one
  is clicked it leads to an appending a string to the h1 in element-two`,
  play: async ({ findByAttribute, assert, fireEvent }) => {
    let button = await findByAttribute('p-target', 'button')
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
