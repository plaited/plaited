import { story } from 'plaited/testing'
import { ToggleInput } from './ToggleInput.tsx'

export const checkbox = story<typeof ToggleInput>({
  description: 'Default checkbox state',
  template: ToggleInput,
  async play() {
    const checkbox = document.querySelector(ToggleInput.tag)
    checkbox?.setAttribute('checked', '')
  },
})

export const checked = story<typeof ToggleInput>({
  description: 'Checked state',
  template: ToggleInput,
  args: {
    checked: true,
  },
})

export const disabled = story<typeof ToggleInput>({
  description: 'Disabled state',
  template: ToggleInput,
  args: {
    disabled: true,
  },
})

export const disabledAndChecked = story<typeof ToggleInput>({
  description: 'Disabled and checked state',
  template: ToggleInput,
  args: {
    disabled: true,
    checked: true,
  },
})
