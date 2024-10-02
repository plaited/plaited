import { StoryObj } from '../../workshop/workshop.types.js'
import { Subscriber, Publisher } from './store.js'

export const Signal: StoryObj = {
  template: () => {
    return (
      <>
        <Publisher />
        <Subscriber />
      </>
    )
  },
  play: async ({ assert, findByAttribute, fireEvent }) => {
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
