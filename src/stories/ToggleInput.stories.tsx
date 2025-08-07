import { type StoryObj } from 'plaited/testing'
import { ToggleInput } from './ToggleInput.js'

export const checkbox: StoryObj = {
  description: 'Default checkbox state',
  template: ToggleInput,
  async play() {
    const checkbox = document.querySelector(ToggleInput.tag)
    checkbox?.setAttribute('checked', '')
  },
}

export const checked: StoryObj = {
  description: 'Checked state',
  template: ToggleInput,
  args: {
    checked: true,
  },
}

export const disabled: StoryObj = {
  description: 'Disabled state',
  template: ToggleInput,
  args: {
    disabled: true,
  },
}

export const disabledAndChecked: StoryObj = {
  description: 'Disabled and checked state',
  template: ToggleInput,
  args: {
    disabled: true,
    checked: true,
  },
}
