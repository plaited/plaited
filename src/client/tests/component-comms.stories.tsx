import { StoryObj } from '../../workshop.js'
import { ElOne, ElTwo } from './component-comms.js'

export const componentComms: StoryObj = {
  template: () => {
    return (
      <>
        <ElOne bp-address='one' />
        <ElTwo bp-address='two' />
      </>
    )
  },
  play: async ({ findByAttribute, assert, fireEvent}) => {
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
