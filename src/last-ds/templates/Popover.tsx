import { defineTemplate, css } from 'plaited'
// import { isTypeOf, keyMirror } from 'plaited/utils'

const styles = css.create({
  button: {
    unset: 'all',
    display: 'contents',
  },
})

// const hostStyles = css.host({
//   display: 'contents',
// })

export const DecoratedPopover = defineTemplate({
  tag: 'decorated-popover',
  shadowDom: (
    <>
      <button
        p-target='button'
        popovertarget='my-popover'
        {...styles.button}
      >
        <slot name='popover-trigger'></slot>
      </button>
      <div
        popover
        id='my-popover'
      >
        <slot name='popover-target'></slot>
      </div>
    </>
  ),
  bProgram({ $ }) {
    // let [popoverTrigger] = $<HTMLSlotElement>('popover-trigger')
    // let [popoverTarget] = $<HTMLSlotElement>('popover-target')
    const [button] = $<HTMLSlotElement>('button')
    return {
      slotchange() {},
      onConnected() {
        console.dir(button.getBoundingClientRect())
      },
    }
  },
})
