import { assert, wait } from '@plaited/storybook-rite'
import { Meta, StoryObj } from '@plaited/storybook'
import { Component } from '../component.js'
import { PlaitedElement, createStyles } from '../../index.js'

const meta: Meta = {
  title: 'Tests/dynamicStyles',
  component: () => <></>,
}

export default meta

const { noRepeat, repeat } = createStyles({
  noRepeat: {
    color: 'blue',
    textDecoration: 'underline',
  },
  repeat: {
    color: 'purple',
    textDecoration: 'underline',
  },
})
const DynamicOnly = Component({
  publicEvents: ['render'],
  tag: 'dynamic-only',
  template: <div bp-target='target'></div>,
  bp({ $ }) {
    return {
      render() {
        const [target] = $<HTMLDivElement>('target')
        target.insert('beforeend', <div {...noRepeat}>construable stylesheet applied once</div>)
        target.insert('beforeend', <div {...repeat}>not applied</div>)
      },
    }
  },
})

export const basic: StoryObj = {
  render: () => <DynamicOnly />,
  play: async () => {
    const target = document.querySelector<PlaitedElement>(DynamicOnly.tag)
    const shadowRoot = target?.shadowRoot
    target?.trigger({ type: 'render' })
    await wait(60)
    assert({
      given: 'dynamic render of the same stylesheet twice',
      should: 'have adoptedStyleSheets of length 3',
      actual: shadowRoot?.adoptedStyleSheets.length,
      expected: 3,
    })
  },
}

const { root, override } = createStyles({
  root: {
    color: 'blue',
  },
  override: {
    color: 'red',
  },
})

const WithDefaultStyles = Component({
  publicEvents: ['render'],
  tag: 'with-default-styles',
  template: (
    <div
      bp-target='target-2'
      {...root}
    ></div>
  ),
  bp({ $ }) {
    return {
      render() {
        const [target] = $<HTMLDivElement>('target-2')
        target.insert(
          'beforeend',
          <div
            className={[override.className, root.className]}
            stylesheet={[...override.stylesheet, ...root.stylesheet]}
          >
            construable stylesheet applied only for second sheet
          </div>,
        )
      },
    }
  },
})

export const withDefault: StoryObj = {
  render: () => <WithDefaultStyles />,
  play: async () => {
    const target = document.querySelector<PlaitedElement>(WithDefaultStyles.tag)
    const shadowRoot = target?.shadowRoot
    target?.trigger({ type: 'render' })
    await wait(60)
    assert({
      given: 'dynamic render with default styles from template',
      should: 'have adoptedStyleSheets of length 2',
      actual: shadowRoot?.adoptedStyleSheets.length,
      expected: 2,
    })
  },
}
