import { type StoryObj } from 'plaited/assert'
import { DecoratedCheckbox } from './Checkbox.js'

export const checkbox: StoryObj = {
  template: DecoratedCheckbox,
  async play() {
    const [checkbox] = document.getElementsByTagName('decorated-checkbox')
    checkbox?.setAttribute('checked', '')
  },
}

export const checked: StoryObj = {
  template: DecoratedCheckbox,
  args: {
    checked: true,
  },
}

export const disabled: StoryObj = {
  template: DecoratedCheckbox,
  args: {
    disabled: true,
  },
}

export const disabledAndChecked: StoryObj = {
  template: DecoratedCheckbox,
  args: {
    disabled: true,
    checked: true,
  },
}
