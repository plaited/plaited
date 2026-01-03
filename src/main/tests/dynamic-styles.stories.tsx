import type { BehavioralElement } from 'plaited'
import { story } from 'plaited/testing'

import { DynamicStyleHost, styles } from './fixtures/dynamic-styles.tsx'

export const dynamicStyles = story({
  description: `This story is used to validate that when rendering/inserting new JSX with styles
  into the Behavioral element shadow dom those styles sheets are applied to the constructed styles
  and do not repeat`,
  template: () => <DynamicStyleHost data-testid='element' />,
  play: async ({ findByText, assert, findByAttribute, wait }) => {
    const template = document.createElement('template')
    template.setHTMLUnsafe((<DynamicStyleHost />).html.join(''))
    const style = await findByText(styles.initial.stylesheets.join(''), template.content as unknown as HTMLElement)
    assert({
      given: 'Render with initial stylesheet, Style tag',
      should: 'have the initial stylesheet only',
      actual: style?.textContent,
      expected: styles.initial.stylesheets.join(''),
    })
    let target = await findByAttribute<BehavioralElement>('data-testid', 'element')
    assert({
      given: 'target has not been triggered',
      should: 'have adoptedStyleSheets of length 1',
      actual: target?.shadowRoot?.adoptedStyleSheets.length,
      expected: 1,
    })
    target?.trigger({ type: 'render' })
    await wait(60)
    target = await findByAttribute<BehavioralElement>('data-testid', 'element')
    assert({
      given: 'target has been triggered',
      should: 'have adoptedStyleSheets of length 3',
      actual: target?.shadowRoot?.adoptedStyleSheets.length,
      expected: 4,
    })
  },
})
