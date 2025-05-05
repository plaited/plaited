/**
 * Test stories for form-associated custom elements in Plaited.
 * Validates form control behavior and state management.
 *
 * Story Features:
 * - Form control initialization
 * - State synchronization
 * - Disabled state handling
 * - Value management
 * - Attribute changes
 *
 * Test Coverage:
 * - Toggle input behavior
 * - Attribute management
 * - Form value updates
 * - Disabled state behavior
 * - Initial state setup
 */

import { type StoryObj } from 'plaited/testing'
import { ToggleInput } from './form-associated-example.js'

export const checkbox: StoryObj = {
  description: `renders toggle input and validates we can set attribute on it and it chenges`,
  template: ToggleInput,
  async play() {
    const checkbox = document.querySelector(ToggleInput.tag)
    checkbox?.setAttribute('checked', '')
  },
}

export const checked: StoryObj = {
  description: `renders toggle input checked`,
  template: ToggleInput,
  args: {
    checked: true,
  },
}

export const disabled: StoryObj = {
  description: `renders toggle input disabled`,
  template: ToggleInput,
  args: {
    disabled: true,
  },
}

export const disabledAndChecked: StoryObj = {
  description: `renders toggle input disabled and checked`,
  template: ToggleInput,
  args: {
    disabled: true,
    checked: true,
  },
}
