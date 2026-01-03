import { story } from 'plaited/testing'

import { ToggleInput } from './fixtures/form-associated.tsx'

export const uncheckedState = story<typeof ToggleInput>({
  description: `renders toggle input and validates we can set attribute on it and it chenges`,
  template: ToggleInput,
  async play() {
    const checkbox = document.querySelector(ToggleInput.tag)
    checkbox?.setAttribute('checked', '')
  },
})

export const checked = story<typeof ToggleInput>({
  description: `renders toggle input checked`,
  template: ToggleInput,
  args: {
    checked: true,
  },
})

export const disabled = story<typeof ToggleInput>({
  description: `renders toggle input disabled`,
  template: ToggleInput,
  args: {
    disabled: true,
  },
})

export const disabledAndChecked = story<typeof ToggleInput>({
  description: `renders toggle input disabled and checked`,
  template: ToggleInput,
  args: {
    disabled: true,
    checked: true,
  },
})
