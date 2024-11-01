import type { FT } from '../../jsx/jsx.types.js'
import { isTypeOf } from '../../utils/is-type-of.js'
import type { PlaitedElement } from '../define-element.js'
import { defineTemplate } from '../define-template.js'
import { useDispatch } from '../use-dispatch.js'
const isPlaitedElement = (el: unknown): el is PlaitedElement =>
  isTypeOf<PlaitedElement>(el, 'htmlelement') && 'trigger' in el

const getPlaitedChildren = (slot: HTMLSlotElement) => [...slot.assignedElements()].filter(isPlaitedElement)

const Inner = defineTemplate({
  tag: 'inner-component',
  shadowDom: <h1 p-target='header'>Hello</h1>,
  publicEvents: ['add'],
  bProgram({ $, bThreads, bThread, bSync }) {
    const dispatch = useDispatch(this)
    bThreads.set({
      onAdd: bThread([bSync({ waitFor: 'add' }), bSync({ request: { type: 'disable' } })]),
    })
    return {
      disable() {
        dispatch({ type: 'disable', bubbles: true })
      },
      add(detail: string) {
        const [header] = $('header')
        header.insert('beforeend', <>{detail}</>)
      },
    }
  },
})

const Outer = defineTemplate({
  tag: 'outer-component',
  shadowDom: (
    <div>
      <slot
        p-target='slot'
        p-trigger={{ disable: 'disable' }}
      ></slot>
      <button
        p-target='button'
        p-trigger={{ click: 'click' }}
      >
        Add "world!"
      </button>
    </div>
  ),
  bProgram({ $ }) {
    return {
      disable() {
        const [button] = $<HTMLButtonElement>('button')
        button && (button.disabled = true)
      },
      click() {
        const [slot] = $<HTMLSlotElement>('slot')
        const [el] = getPlaitedChildren(slot)
        el.trigger({ type: 'add', detail: ' World!' })
      },
    }
  },
})

export const Template: FT = () => (
  <Outer>
    <Inner />
  </Outer>
)
