import { type StoryObj } from 'plaited/test'
import { ToggleInput } from './ToggleInput.js'

export const checkbox: StoryObj = {
  template: ToggleInput,
  async play() {
    const checkbox = document.querySelector(ToggleInput.tag)
    checkbox?.setAttribute('checked', '')
  },
}

export const checked: StoryObj = {
  template: ToggleInput,
  args: {
    checked: true,
  },
}

export const disabled: StoryObj = {
  template: ToggleInput,
  args: {
    disabled: true,
  },
}

export const disabledAndChecked: StoryObj = {
  template: ToggleInput,
  args: {
    disabled: true,
    checked: true,
  },
}
