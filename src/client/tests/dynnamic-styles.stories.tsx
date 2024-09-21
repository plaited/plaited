import { StoryObj } from '../../workshop/workshop.types.js'
import { defineTemplate } from '../define-template.js'
import type { PlaitedElement } from '../define-element.js'
import { css } from '../../css/css.js'

const { noRepeat, repeat, initial } = css.create({
  initial: {
    border: '1px solid black',
  },
  noRepeat: {
    color: 'blue',
    textDecoration: 'underline',
  },
  repeat: {
    color: 'purple',
    textDecoration: 'underline',
  },
})
const DynamicOnly = defineTemplate({
  publicEvents: ['render'],
  tag: 'dynamic-only',
  shadowDom: (
    <div
      p-target='target'
      {...initial}
    ></div>
  ),
  connectedCallback({ $ }) {
    return {
      render() {
        const [target] = $<HTMLDivElement>('target')
        target.insert('beforeend', <div {...noRepeat}>construable stylesheet applied once</div>)
        target.insert('beforeend', <div {...repeat}>not applied</div>)
      },
    }
  },
})

export const dynamicStyles: StoryObj = {
  template: () => <DynamicOnly data-testid='target' />,
  play: async ({ findByText, assert, findByAttribute, wait}) => {
    const style = await findByText(initial.stylesheet.join(''))
    assert({
      given: 'Render with initial stylesheet, Style tag',
      should: 'have the initial stylesheet only',
      actual: style?.textContent,
      expected: initial.stylesheet.join(''),
    })
    const target = await findByAttribute<PlaitedElement>('data-testid', 'target')
    assert({
      given: 'target has not been triggered',
      should: 'have adoptedStyleSheets of length 0',
      actual: target?.shadowRoot?.adoptedStyleSheets.length,
      expected: 0,
    })
    target?.trigger({ type: 'onAdopted' })
    await wait(60)
    assert({
      given: 'target has been triggered',
      should: 'have adoptedStyleSheets of length 3',
      actual: target?.shadowRoot?.adoptedStyleSheets.length,
      expected: 3,
    })
  },
}
