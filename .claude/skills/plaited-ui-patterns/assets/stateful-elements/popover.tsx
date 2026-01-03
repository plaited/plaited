import { bElement } from 'plaited'
import { isTypeOf } from 'plaited/utils'

/**
 * DecoratedPopoverClose - Close button for popover
 *
 * Emits 'close' event that bubbles to parent DecoratedPopover.
 * Demonstrates child-to-parent communication via emit().
 */
export const DecoratedPopoverClose = bElement({
  tag: 'decorated-popover-close',
  shadowDom: <slot p-trigger={{ click: 'click' }}></slot>,
  bProgram: ({ emit }) => {
    return {
      click() {
        emit({ type: 'close', bubbles: true, composed: true })
      },
    }
  },
})

/**
 * DecoratedPopover - Wrapper for native popover API
 *
 * Demonstrates stateful element pattern with custom states.
 * Syncs custom states with native popover visibility.
 * Uses slots for flexible content composition.
 */
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
    const popover = $<HTMLDivElement>('popover')[0]

    return {
      close() {
        internals.states.delete('open')
        popover?.hidePopover()
      },

      toggle() {
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
        // Initialize states from attributes
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
