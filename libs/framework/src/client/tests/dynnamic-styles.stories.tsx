import { assert, wait, findByText, findByAttribute } from '@plaited/storybook-rite'
import { Meta, StoryObj } from '@plaited/storybook'
import { defineTemplate } from '../define-template.js'
import { PlaitedElement, createStyles } from '../../index.js'

const meta: Meta = {
  title: 'Tests',
  component: () => <></>,
}

export default meta

const { noRepeat, repeat, initial } = createStyles({
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
  render: () => <DynamicOnly data-testid='target' />,
  play: async () => {
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
    target?.trigger({ type: 'render' })
    await wait(60)
    assert({
      given: 'target has been triggered',
      should: 'have adoptedStyleSheets of length 3',
      actual: target?.shadowRoot?.adoptedStyleSheets.length,
      expected: 3,
    })
  },
}
