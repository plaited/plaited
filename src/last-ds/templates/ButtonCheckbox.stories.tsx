import { type StoryObj } from 'plaited/assert'
import { ButtonCheckbox } from './ButtonCheckbox.js'

export const checkbox: StoryObj = {
  template: ButtonCheckbox,
  async play() {
    const checkbox = document.querySelector(ButtonCheckbox.tag)
    checkbox?.setAttribute('checked', '')
  },
}

export const checked: StoryObj = {
  template: ButtonCheckbox,
  args: {
    checked: true,
  },
}

export const disabled: StoryObj = {
  template: ButtonCheckbox,
  args: {
    disabled: true,
  },
}

export const disabledAndChecked: StoryObj = {
  template: ButtonCheckbox,
  args: {
    disabled: true,
    checked: true,
  },
}
