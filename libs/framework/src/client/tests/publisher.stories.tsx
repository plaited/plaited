import { assert, findByAttribute, fireEvent } from '@plaited/storybook-rite'
import { Meta, StoryObj } from '@plaited/storybook'
import { Subscriber, Publisher } from './publisher.js'

const meta: Meta = {
  title: 'Tests',
  component: () => <></>,
}

export default meta

export const PubSub: StoryObj = {
  render: () => {
    return (
      <>
        <Publisher />
        <Subscriber />
      </>
    )
  },
  play: async () => {
    const button = await findByAttribute('p-target', 'button')
    const count = await findByAttribute('p-target', 'count')
    assert({
      given: 'mount',
      should: 'increment count',
      actual: count?.textContent,
      expected: '0',
    })
    button && (await fireEvent(button, 'click'))
    assert({
      given: 'button click',
      should: 'increment count',
      actual: count?.textContent,
      expected: '1',
    })
    button && (await fireEvent(button, 'click'))
    assert({
      given: 'button click',
      should: 'increment count',
      actual: count?.textContent,
      expected: '2',
    })
  },
}
