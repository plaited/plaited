import type { StoryObj } from '../../assert/assert.types.js'
import { Fixture } from './signal.js'

export const Signal: StoryObj = {
  template: Fixture,
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
