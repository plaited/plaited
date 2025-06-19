import { defineElement, type PlaitedElement, isPlaitedElement } from 'plaited'
import type { StoryObj } from 'plaited/workshop'

import { styles } from './hydrating-element.css.js'
const TRIGGER_HYDRATING_ELEMENT = 'TRIGGER_HYDRATING_ELEMENT'
const FIXTURE_ELEMENT_TAG = 'fixture-element'
const EMPTY_SLOT = 'Empty slot'

const HydrationFixture = defineElement({
  tag: FIXTURE_ELEMENT_TAG,
  publicEvents: [TRIGGER_HYDRATING_ELEMENT],
  streamAssociated: true,
  shadowDom: (<slot p-target="slot">{EMPTY_SLOT}</slot>
  ),
  bProgram({$}){
    return {
      [TRIGGER_HYDRATING_ELEMENT]() {
        const [slot] = $<HTMLSlotElement>('slot')
        const [el] = slot.assignedElements()
        const slotTrigger = isPlaitedElement(el) ? el.trigger : null
        slotTrigger?.({type: 'update'})
      }
    }
  }
})

export const test: StoryObj = {
  description: `Element that will be fetched as an include in another story to hydrate, ./main/tests/hydration-fixture.stories.tsx`,
  template: () => <HydrationFixture data-testid="fixture"/>,
  async play({ findByText, assert, findByAttribute }) {
    const res = await fetch('/main/tests/hydrating-element--target.template')
    const responseText = await res.text() // Get the HTML as a string

    const htmlTemplate = document.createElement('template') // Create a <template> element
    htmlTemplate.setHTMLUnsafe(responseText)
    const styleElementBeforeHydration = await findByText(styles.before.stylesheet.join(' '), htmlTemplate.content as unknown as HTMLElement)
    assert({
      given: 'before streaming target',
      should: 'have style tag',
      actual: styleElementBeforeHydration?.tagName,
      expected: 'STYLE',
    })

    const fixture = await findByAttribute<PlaitedElement>('data-testid', "fixture")

    assert({
      given: 'before streaming fixture shadowDom',
      should: 'have text content',
      actual: fixture?.shadowRoot?.textContent,
      expected: EMPTY_SLOT,
    })

    fixture?.trigger({type: 'onReplaceChildren', detail: responseText})
  },
}
