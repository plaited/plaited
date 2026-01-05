import { story } from 'plaited/testing'
import { AFTER_HYDRATION, BEFORE_HYDRATION, HYDRATING_ELEMENT_TAG } from './fixtures/hydrating-element.constants.ts'
import { styles } from './fixtures/hydrating-element.css.ts'
import { ShadowDom } from './fixtures/hydrating-element-shadow-dom.tsx'

const { stylesheets, classNames } = styles.before

export const hydration = story({
  intent: 'Validates hydration of declarative shadow DOM when element definition is dynamically imported',
  template: () => (
    // Pre-hydration state: custom element with declarative shadow DOM
    // The bElement is NOT imported yet, so this is just inert HTML
    <hydrating-element data-testid='target'>
      <template shadowrootmode='open'>
        <style>{stylesheets.join('')}</style>
        <ShadowDom classNames={classNames} />
      </template>
    </hydrating-element>
  ),
  async play({ assert, wait }) {
    // Verify pre-hydration state (before element is defined)
    const target = document.querySelector<HTMLElement>(HYDRATING_ELEMENT_TAG)
    const shadowBefore = target?.shadowRoot

    assert({
      given: 'before element is defined',
      should: 'have declarative shadow DOM',
      actual: shadowBefore !== null,
      expected: true,
    })

    const contentBefore = shadowBefore?.querySelector<HTMLElement>('[p-target="inner"]')

    assert({
      given: 'before element is defined',
      should: 'content should be a DIV',
      actual: contentBefore?.tagName,
      expected: 'DIV',
    })

    assert({
      given: 'before element is defined',
      should: 'have before hydration text',
      actual: contentBefore?.innerText,
      expected: BEFORE_HYDRATION,
    })

    assert({
      given: 'before element is defined',
      should: 'have underline decoration',
      actual: contentBefore?.computedStyleMap().get('text-decoration-line')?.toString(),
      expected: 'underline',
    })

    // Dynamically import the element definition to trigger hydration
    await import('./fixtures/hydrating-element.tsx')
    await customElements.whenDefined(HYDRATING_ELEMENT_TAG)
    await wait(60)

    // Verify post-hydration state
    const contentAfter = target?.shadowRoot?.querySelector<HTMLElement>('[p-target="inner"]')

    assert({
      given: 'after element hydrates',
      should: 'content should be a SPAN',
      actual: contentAfter?.tagName,
      expected: 'SPAN',
    })

    assert({
      given: 'after element hydrates',
      should: 'have after hydration text',
      actual: contentAfter?.innerText,
      expected: AFTER_HYDRATION,
    })

    assert({
      given: 'after element hydrates',
      should: 'have line-through decoration',
      actual: contentAfter?.computedStyleMap().get('text-decoration-line')?.toString(),
      expected: 'line-through',
    })
  },
})
