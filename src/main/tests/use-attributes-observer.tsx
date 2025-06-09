import { defineElement, useAttributesObserver } from 'plaited'

export const AttributesObserver = defineElement({
  tag: 'attribute-observer',
  shadowDom: (
    <>
      <slot p-target='slot'></slot>
      <p p-target='name'></p>
      <p p-target='oldValue'></p>
      <p p-target='newValue'></p>
    </>
  ),
  bProgram({ $, trigger }) {
    const [slot] = $<HTMLSlotElement>('slot')
    const [name] = $<HTMLSpanElement>('name')
    const [oldValue] = $<HTMLSpanElement>('oldValue')
    const [newValue] = $<HTMLSpanElement>('newValue')
    const [el] = slot.assignedElements()
    const observe = useAttributesObserver('change', trigger)
    observe(el, ['disabled', 'value'])
    return {
      change(detail: { name: string; oldValue: string | null; newValue: string | null }) {
        name.render(detail.name)
        oldValue.render(detail.oldValue ?? 'null')
        newValue.render(detail.newValue ?? 'null')
      },
    }
  },
})
