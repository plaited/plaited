import { story } from 'plaited/testing.ts'
import { isTypeOf } from 'plaited/utils.ts'
import { bElement, createHostStyles, createStyles, joinStyles } from 'plaited.ts'

const componentStyles = createStyles({
  symbol: {
    height: '16px',
    width: '16px',
    backgroundColor: 'var(--fill)',
    gridArea: 'input',
  },
})

const componentHostStyles = createHostStyles({
  display: 'inline-grid',
  '--fill': {
    $default: 'lightblue',
    $compoundSelectors: {
      ':state(checked)': 'blue',
      ':state(disabled)': 'grey',
    },
  },
})

const ToggleInput = bElement<{
  click: MouseEvent & { target: HTMLInputElement }
  checked: boolean
  disabled: boolean
  valueChange: string | null
}>({
  tag: 'toggle-input',
  observedAttributes: ['disabled', 'checked', 'value'],
  formAssociated: true,
  shadowDom: (
    <div
      p-target='symbol'
      {...joinStyles(componentStyles.symbol, componentHostStyles)}
      p-trigger={{ click: 'click' }}
    />
  ),
  bProgram({ trigger, internals, root, bThreads, bSync, bThread }) {
    bThreads.set({
      onDisabled: bThread(
        [
          bSync({
            block: [
              ({ type }) => type === 'checked' && internals.states.has('disabled'),
              ({ type }) => type === 'valueChange' && internals.states.has('disabled'),
            ],
          }),
        ],
        true,
      ),
    })
    return {
      click() {
        trigger({ type: 'checked', detail: !internals.states.has('checked') })
      },
      checked(val) {
        root.host.toggleAttribute('checked', val)
        if (val) {
          internals.states.add('checked')
          internals.setFormValue('on', root.host.getAttribute('value') ?? 'checked')
        } else {
          internals.states.delete('checked')
          internals.setFormValue('off')
        }
      },
      disabled(val) {
        if (val) {
          internals.states.add('disabled')
        } else {
          internals.states.delete('disabled')
        }
      },
      valueChange(val) {
        const isChecked = internals.states.has('checked')
        if (val && isChecked) {
          internals.setFormValue('on', val)
        } else if (isChecked) {
          internals.setFormValue('on', 'checked')
        }
      },
      onAttributeChanged({ name, newValue }) {
        name === 'checked' && trigger({ type: 'checked', detail: isTypeOf<string>(newValue, 'string') })
        name === 'disabled' && trigger({ type: 'disabled', detail: isTypeOf<string>(newValue, 'string') })
        name === 'value' && trigger({ type: 'valueChange', detail: newValue })
      },
      onConnected() {
        if (root.host.hasAttribute('checked')) {
          internals.states.add('checked')
          internals.setFormValue('on', root.host.getAttribute('value') ?? 'checked')
        }
        if (root.host.hasAttribute('disabled')) {
          internals.states.add('disabled')
        }
      },
    }
  },
})

export const checkbox = story<typeof ToggleInput>({
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
