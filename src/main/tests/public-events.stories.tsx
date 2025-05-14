/**
 * Test stories for validating public event handling in Plaited components.
 * Demonstrates parent-child component communication through custom events.
 *
 * Story Features:
 * - Custom event propagation
 * - Parent-child communication
 * - Event handling validation
 * - State synchronization
 * - Component lifecycle events
 *
 * Test Scenarios:
 * - Event triggering and handling
 * - DOM updates from events
 * - Component state changes
 * - Button state management
 * - Event cleanup
 */

import type { StoryObj } from 'plaited/testing'
import { Template } from './public-events.js'

export const publicEvents: StoryObj = {
  description: `This story is used to validate that the publicEvents parameter
  of defineElement allows for triggering a public event on a plaited element`,
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
