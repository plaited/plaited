/**
 * Example of creating a custom checkbox component that decorates a standard HTML input element
 * with enhanced visual styling and state management.
 *
 * Key Features:
 * - Uses CSS custom properties for dynamic styling
 * - Manages checked and disabled states
 * - Preserves native input functionality
 * - Uses Shadow DOM for style encapsulation
 * - Demonstrates attribute observation pattern
 *
 * @example
 * ```tsx
 * // Basic usage
 * const MyForm = () => (
 *   <form>
 *     <DecoratedCheckbox
 *       name="accept"
 *       checked={true}
 *       onChange={(e) => console.log(e.target.checked)}
 *     />
 *   </form>
 * );
 *
 * // With disabled state
 * const DisabledExample = () => (
 *   <DecoratedCheckbox
 *     disabled={true}
 *     checked={true}
 *   />
 * );
 * ```
 */

import {
  defineElement,
  css,
  useAttributesObserver,
  type ObservedAttributesDetail,
  type FT,
  type ElementAttributeList,
} from 'plaited'
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

export const DecorateCheckbox = defineElement<{
  change(detail: ObservedAttributesDetail): void
  slotchange(): void
}>({
  tag: 'decorate-checkbox',
  shadowDom: (
    <>
      <div
        p-target='symbol'
        {...css.assign(styles.symbol, hostStyles)}
        p-trigger={{ click: 'click' }}
      />
      <slot
        p-target='slot'
        p-trigger={{ slotchange: 'slotchange' }}
      ></slot>
    </>
  ),
  bProgram({ $, internals, trigger }) {
    let [slot] = $<HTMLSlotElement>('slot')
    let [input] = slot.assignedElements()
    let inputObserver = useAttributesObserver('change', trigger)
    return {
      slotchange() {
        ;[slot] = $<HTMLSlotElement>('slot')
        ;[input] = slot.assignedElements()
        inputObserver = useAttributesObserver('change', trigger)
      },
      change({ name, newValue }) {
        isTypeOf<string>(newValue, 'string') ? internals.states.add(name) : internals.states.delete(name)
      },
      onConnected() {
        input.hasAttribute('checked') && internals.states.add('checked')
        input.hasAttribute('disabled') && internals.states.add('disabled')
        inputObserver(input, ['checked', 'disabled'])
      },
    }
  },
})

export const DecoratedCheckbox: FT<ElementAttributeList['input']> = (props) => {
  return (
    <DecorateCheckbox>
      <input
        {...props}
        {...styles.input}
        type='checkbox'
      />
    </DecorateCheckbox>
  )
}
