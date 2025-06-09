import { type StoryObj, STORY_PURPOSE } from 'plaited/workshop'
import { ToggleInput } from './ToggleInput.js'

export const checkbox: StoryObj = {
  description: 'Default checkbox state',
  template: ToggleInput,
  async play() {
    const checkbox = document.querySelector(ToggleInput.tag)
    checkbox?.setAttribute('checked', '')
  },
  parameters: {
    purpose: STORY_PURPOSE.demo,
  },
}

export const checked: StoryObj = {
  description: 'Checked state',
  template: ToggleInput,
  args: {
    checked: true,
  },
  parameters: {
    purpose: STORY_PURPOSE.demo,
  },
}

export const disabled: StoryObj = {
  description: 'Disabled state',
  template: ToggleInput,
  args: {
    disabled: true,
  },
  parameters: {
    purpose: STORY_PURPOSE.demo,
  },
}

export const disabledAndChecked: StoryObj = {
  description: 'Disabled and checked state',
  template: ToggleInput,
  args: {
    disabled: true,
    checked: true,
  },
  parameters: {
    purpose: STORY_PURPOSE.demo,
  },
}
