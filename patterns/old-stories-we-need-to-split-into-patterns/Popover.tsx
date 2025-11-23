import { bElement, useDispatch } from 'plaited'
import { isTypeOf } from 'plaited/utils'

export const DecoratedPopoverClose = bElement({
  tag: 'decorated-popover-close',
  shadowDom: <slot p-trigger={{ click: 'click' }}></slot>,
  bProgram: ({ host }) => {
    const dispatch = useDispatch(host)
    return {
      click() {
        dispatch({ type: 'close', bubbles: true, composed: true })
      },
    }
  },
})

export const DecoratedPopover = bElement({
  tag: 'decorated-popover',
  observedAttributes: ['disabled', 'open'],
  publicEvents: ['close'],
  shadowDom: (
    <>
      <slot
        name='popover-trigger'
        p-trigger={{ click: 'toggle' }}
      ></slot>
      <div
        popover
        id='my-popover'
        p-target='popover'
      >
        <slot
          name='popover-target'
          p-trigger={{ close: 'close' }}
        ></slot>
      </div>
    </>
  ),
  bProgram({ $, host, internals, trigger }) {
    const [popover] = $<HTMLSlotElement>('popover')
    return {
      close() {
        internals.states.delete('open')
        popover?.hidePopover()
      },
      toggle(e) {
        console.table(e.target.getBoundingClientRect())
        if (internals.states.has('open')) {
          internals.states.delete('open')
        } else {
          internals.states.add('open')
        }
        popover?.togglePopover()
      },
      slotchange() {},
      onAttributeChanged({ name, newValue }) {
        name === 'open' &&
          trigger({
            type: 'open',
            detail: isTypeOf<string>(newValue, 'string'),
          })
        name === 'disabled' &&
          trigger({
            type: 'disabled',
            detail: isTypeOf<string>(newValue, 'string'),
          })
      },
      onConnected() {
        if (host.hasAttribute('open')) {
          internals.states.add('open')
        }
        if (host.hasAttribute('disabled')) {
          internals.states.add('disabled')
        }
      },
    }
  },
})
