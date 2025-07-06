import { defineElement, type PlaitedElement, useFetch } from 'plaited'
import type { StoryObj } from 'plaited/workshop'

import { styles, GREEN, RED } from './hydrating-element.css.js'
const TRIGGER_HYDRATING_ELEMENT = 'TRIGGER_HYDRATING_ELEMENT'
const FIXTURE_ELEMENT_TAG = 'fixture-element'
const EMPTY_SLOT = 'Empty slot'
const FETCH_AND_IMPORT = 'FETCH_AND_IMPORT'

const HydrationFixture = defineElement({
  tag: FIXTURE_ELEMENT_TAG,
  publicEvents: [TRIGGER_HYDRATING_ELEMENT, FETCH_AND_IMPORT],
  shadowDom: <slot p-target='slot'>{EMPTY_SLOT}</slot>,
  bProgram({ $, trigger }) {
    return {
      async [FETCH_AND_IMPORT](detail: string) {
        const res = await useFetch({
          type: 'onError',
          trigger,
          url: detail,
        })
        const frag = await res?.html()
        const [slot] = $<HTMLSlotElement>('slot')
        frag && slot.replace(frag)
      },
      async [TRIGGER_HYDRATING_ELEMENT]() {
        const [target] = $<PlaitedElement>('hydrating-element')
        target.trigger({ type: 'update' })
      },
    }
  },
})

export const test: StoryObj = {
  description: `Element that will be fetched as an include in another story to hydrate, ./main/tests/hydration-fixture.stories.tsx`,
  template: () => <HydrationFixture data-testid='fixture' />,
  async play({ findByText, assert, findByAttribute, wait }) {
    const route = '/main/tests/hydrating-element--target.template'
    const res = await fetch(route)
    const responseText = await res.text() // Get the HTML as a string

    const htmlTemplate = document.createElement('template') // Create a <template> element
    htmlTemplate.setHTMLUnsafe(responseText)
    const styleElementBeforeHydration = await findByText(
      styles.before.stylesheet.join(' '),
      htmlTemplate.content as unknown as HTMLElement,
    )
    assert({
      given: 'before streaming target',
      should: 'have style tag',
      actual: styleElementBeforeHydration?.tagName,
      expected: 'STYLE',
    })

    const fixture = await findByAttribute<PlaitedElement>('data-testid', 'fixture')

    assert({
      given: 'before streaming fixture shadowDom',
      should: 'have text content',
      actual: fixture?.shadowRoot?.textContent,
      expected: EMPTY_SLOT,
    })

    fixture?.trigger({ type: FETCH_AND_IMPORT, detail: route })
    await wait(100)
    const target = await findByAttribute<PlaitedElement>('data-testid', 'target')
    const styleElementAfterHydration = await findByText(styles.before.stylesheet.join(' '), target)

    assert({
      given: 'after streaming target',
      should: 'not have style tag',
      actual: styleElementAfterHydration,
      expected: undefined,
    })

    let inner = await findByAttribute<PlaitedElement>('p-target', 'inner')

    assert({
      given: 'before triggering update on target',
      should: 'have red color style',
      actual: inner?.computedStyleMap().get('color'),
      expected: RED,
    })

    fixture?.trigger({ type: TRIGGER_HYDRATING_ELEMENT })
    inner = await findByAttribute<PlaitedElement>('p-target', 'inner')

    assert({
      given: 'after triggering update on target',
      should: 'have green color style',
      actual: window.getComputedStyle(inner!).color,
      expected: GREEN,
    })
  },
}
