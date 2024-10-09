import type { StoryObj } from '../../workshop/workshop.types.ts'
import { Fixture } from './signal.tsx'

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
