import { type StoryObj } from 'plaited/test'
import { DelegatedListener, delegates } from '../delegated-listener.js'

export const test: StoryObj = {
  template: () => <button data-testid='button'>click me</button>,
  play: async ({ findByAttribute, fireEvent, assert }) => {
    const btn = await findByAttribute<HTMLButtonElement>('data-testid', 'button')
    let count = 0
    const callback = () => {
      count++
    }
    if (btn) {
      delegates.set(btn, new DelegatedListener(callback))
      btn.addEventListener('click', delegates.get(btn))
      btn.addEventListener('click', delegates.get(btn))
      await fireEvent(btn, 'click')
    }
    assert({
      given: 'attaching listener twice and calling click',
      should: 'only increment by 1',
      actual: count,
      expected: 1,
    })
  },
}
