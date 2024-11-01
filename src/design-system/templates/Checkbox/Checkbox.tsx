import { defineTemplate, css } from 'plaited'
import { isTypeOf } from 'plaited/utils'

const styles = css.create({
  grid: {
    display: 'inline-grid',
    gridTemplate: '"input" 16px / 16px',
  },
  symbol: {
    height: '16px',
    width: '16px',
    backgroundColor: 'var(--fill)',
    gridArea: 'input',
  },
  input: {
    gridArea: 'input',
    height: '16px',
    width: '16px',
    opacity: 0,
    margin: 0,
    padding: 0,
  },
})

const hostStyles = css.host({
  display: 'inline-grid',
  gridTemplate: '"input" 16px / 16px',
  '--fill': {
    default: 'lightblue',
    ':state(checked)': 'blue',
    ':state(disabled)': 'grey',
  },
})

export const DecoratedCheckbox = defineTemplate<{
  click(evt: MouseEvent & { target: HTMLInputElement }): void
  checked(val: boolean): void
  disabled(val: boolean): void
}>({
  tag: 'decorated-checkbox',
  observedAttributes: ['disabled', 'checked'],
  formAssociated: true,
  shadowDom: (
    <>
      <div
        p-target='symbol'
        {...css.assign(styles.symbol, hostStyles)}
        p-trigger={{ click: 'click' }}
      />
    </>
  ),
  bProgram({ trigger, internals, root, bThreads, bSync, bThread }) {
    bThreads.set({
      onDisabled: bThread(
        [bSync({ block: ({ type }) => type === 'checked' && internals.states.has('disabled') })],
        true,
      ),
    })
    return {
      click() {
        trigger({ type: 'update', detail: !internals.states.has('checked') })
      },
      checked(val) {
        if (val) {
          internals.states.add('checked')
          internals.setFormValue('on', 'checked')
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
      onAttributeChanged({ name, newValue }) {
        name === 'checked' && trigger({ type: 'checked', detail: isTypeOf<string>(newValue, 'string') })
        name === 'disabled' && trigger({ type: 'disabled', detail: isTypeOf<string>(newValue, 'string') })
      },
      onConnected() {
        if (root.host.hasAttribute('checked')) {
          internals.states.add('checked')
          internals.setFormValue('on', 'checked')
        }
        if (root.host.hasAttribute('disabled')) {
          internals.states.add('disabled')
          internals.setFormValue('on', 'disabled')
        }
      },
    }
  },
})
