import { assert, findByAttribute, fireEvent } from '@plaited/storybook-rite'
import { Meta, StoryObj } from '@plaited/storybook'
import { ElOne, ElTwo } from './component-comms.js'
const meta: Meta = {
  title: 'Tests',
  component: () => <></>,
}

export default meta

export const componentComms: StoryObj = {
  render: () => {
    return (
      <>
        <ElOne bp-address='one' />
        <ElTwo bp-address='two' />
      </>
    )
  },
  play: async () => {
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
