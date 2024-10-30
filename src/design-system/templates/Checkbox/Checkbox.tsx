import { defineTemplate, type FT, css } from 'plaited'
import { keyMirror } from 'plaited/utils'

const styles = css.create({
  grid: {
    display: 'inline-grid',
    gridTemplate: '"input" 16px / 16px',
  },
  symbol: {
    height: '16px',
    width: '16px',
    backgroundColor: {
      default: 'lightblue',
      '[data-checked="true"]': 'blue',
    },
    gridArea: 'input',
  },
  input: {
    gridArea: 'input',
    height: '16px',
    width: '16px',
    /**
     * TODO
     * need to fix css accepting 0 value
     *
     */
    opacity: '0',
    margin: '0',
    padding: '0',
  },
})

const DecorateCheckbox = defineTemplate<{
  click(evt: MouseEvent & { target: HTMLInputElement }): void
  slotchange(): void
  update(val: boolean): void
}>({
  tag: 'decorate-checkbox',
  shadowDom: (
    <>
      <div
        p-target='symbol'
        {...styles.symbol}
      />
      <slot
        {...css.host({
          display: 'inline-grid',
          gridTemplate: '"input" 16px / 16px',
        })}
        p-trigger={keyMirror('click', 'slotchange')}
        p-target='slot'
      />
    </>
  ),
  connectedCallback({ trigger, $ }) {
    return {
      slotchange() {
        const [slot] = $<HTMLSlotElement>('slot')
        const [input] = slot.assignedElements() as [HTMLInputElement]
        input && trigger({ type: 'update', detail: input.checked })
      },
      click(evt) {
        trigger({ type: 'update', detail: evt.target.checked })
      },
      update(val) {
        const [span] = $('symbol')
        span?.attr('data-checked', val)
      },
    }
  },
})

/**
 * TODO
 * need to fix Stories acceting FT<ElementAttributeList['input]>
 */

export const Checkbox: FT = () => {
  return (
    <DecorateCheckbox>
      <input
        type='checkbox'
        {...styles.input}
      />
    </DecorateCheckbox>
  )
}
