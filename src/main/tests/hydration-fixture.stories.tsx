import { bElement, type PlaitedElement } from 'plaited'
import { createDocumentFragment } from 'plaited/utils'
import type { StoryObj } from 'plaited/workshop'

import { styles, HYDRATING_ELEMENT_TAG, BEFORE_HYDRATION, AFTER_HYDRATION } from './hydrating-element.constants.js'
const TRIGGER_HYDRATING_ELEMENT = 'TRIGGER_HYDRATING_ELEMENT'
const FIXTURE_ELEMENT_TAG = 'fixture-element'
const EMPTY_SLOT = 'Empty slot'
const TRIGGER_HYDRATION = 'TRIGGER_HYDRATION'
const ROUTE = '/main/tests/hydrating-element--target.template'

const HydrationFixture = bElement({
  tag: FIXTURE_ELEMENT_TAG,
  publicEvents: [TRIGGER_HYDRATING_ELEMENT, TRIGGER_HYDRATION],
  shadowDom: <slot p-target='slot'>{EMPTY_SLOT}</slot>,
  bProgram({ $ }) {
    return {
      async [TRIGGER_HYDRATION](detail: string) {
        const frag = createDocumentFragment(detail)
        const [slot] = $<HTMLSlotElement>('slot')
        frag && slot.replace(frag)
      },
    }
  },
})

export const test: StoryObj = {
  description: `Element that will be fetched as an include in another story to hydrate, ./main/tests/hydration-fixture.stories.tsx`,
  template: () => <HydrationFixture data-testid='fixture' />,
  async play({ findByText, assert, findByAttribute, match, wait }) {
    const res = await fetch(ROUTE)
    const responseText = await res.text() // Get the HTML as a string

    const htmlTemplate = document.createElement('template') // Create a <template> element
    htmlTemplate.setHTMLUnsafe(responseText)
    const contentBeforeHydration = await findByAttribute<HTMLDivElement>(
      'p-target',
      'inner',
      htmlTemplate.content as unknown as HTMLElement,
    )

    const styleElementBeforeHydration = await findByText(
      styles.before.stylesheet.join(' '),
      htmlTemplate.content as unknown as HTMLElement,
    )
    assert({
      given: 'before hydrating element is connected',
      should: 'content should be a DIV',
      actual: contentBeforeHydration?.tagName,
      expected: 'DIV',
    })

    assert({
      given: 'before hydrating element is connected',
      should: 'still have before text',
      actual: contentBeforeHydration?.innerText,
      expected: BEFORE_HYDRATION,
    })

    assert({
      given: 'before hydrating element is connected',
      should: 'still have style tag',
      actual: styleElementBeforeHydration?.tagName,
      expected: 'STYLE',
    })

    const contains = match(styleElementBeforeHydration!.innerText)
    const pattern = 'text-decoration:underline'
    assert({
      given: 'before hydrating element is connected',
      should: 'be underlined',
      actual: contains(pattern),
      expected: pattern,
    })

    const fixture = document.querySelector<PlaitedElement>(FIXTURE_ELEMENT_TAG)

    fixture?.trigger({ type: TRIGGER_HYDRATION, detail: responseText })

    await customElements.whenDefined(HYDRATING_ELEMENT_TAG)
    await wait(60)
    const hydratingElement = await findByAttribute<PlaitedElement>('p-target', HYDRATING_ELEMENT_TAG)

    const contentAfterHydration = await findByAttribute<HTMLSpanElement>('p-target', 'inner', hydratingElement)
    const styleElementAfterHydration = await findByText(styles.before.stylesheet.join(' '), hydratingElement)

    assert({
      given: 'after hydrating element is connected',
      should: 'tag should be a span',
      actual: contentAfterHydration?.tagName,
      expected: 'SPAN',
    })

    assert({
      given: 'after hydrating element is connected',
      should: 'have after text',
      actual: contentAfterHydration?.innerText,
      expected: AFTER_HYDRATION,
    })

    assert({
      given: 'after hydrating element is connected',
      should: 'not have style tag',
      actual: styleElementAfterHydration,
      expected: undefined,
    })
    assert({
      given: 'after hydrating element is connected',
      should: 'be striked through',
      actual: contentAfterHydration?.computedStyleMap().get('text-decoration-line')?.toString(),
      expected: 'line-through',
    })
  },
}
