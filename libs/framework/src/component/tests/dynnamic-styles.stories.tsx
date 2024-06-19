import { assert, findByAttribute } from '@plaited/storybook-rite'
import { Meta, StoryObj } from '@plaited/storybook'
import { Component } from '../component.js'
import { createStyles } from '../../index.js'

const meta: Meta = {
  title: 'Tests/dynamicStyles',
  component: () => <></>,
}

export default meta

export const basic: StoryObj = {
  play: async ({ canvasElement }) => {
    const styles = createStyles({
      noRepeat: {
        color: 'blue',
        textDecoration: 'underline',
      },
      repeat: {
        color: 'purple',
        textDecoration: 'underline',
      },
    })
    const Fixture = Component({
      tag: 'dynamic-only',
      template: <div bp-target='target'></div>,
      bp({ $ }) {
        const [target] = $<HTMLDivElement>('target')
        target.insert('beforeend', <div {...styles.noRepeat}>construable stylesheet applied once</div>)
        target.insert('beforeend', <div {...styles.repeat}>not applied</div>)
      },
    })
    Fixture.define()
    canvasElement.append(document.createElement(Fixture.tag))

    const target = await findByAttribute('bp-target', 'target')
    const root = target.getRootNode() as ShadowRoot
    assert({
      given: 'dynamic render of the same stylesheet twice',
      should: 'have adoptedStyleSheets of length 3',
      actual: root.adoptedStyleSheets.length,
      expected: 3,
    })
  },
}

export const withDefault: StoryObj = {
  play: async ({ canvasElement }) => {
    const styles = createStyles({
      root: {
        color: 'blue',
      },
      override: {
        color: 'red',
      },
    })
    const Fixture = Component({
      tag: 'with-default-styles',
      template: (
        <div
          bp-target='target-2'
          {...styles.root}
        ></div>
      ),
      bp({ $ }) {
        const [target] = $<HTMLDivElement>('target-2')
        target.insert(
          'beforeend',
          <div
            className={[styles.override.className, styles.root.className]}
            stylesheet={[...styles.override.stylesheet, ...styles.root.stylesheet]}
          >
            construable stylesheet applied only for second sheet
          </div>,
        )
      },
    })
    Fixture.define()
    canvasElement.append(document.createElement(Fixture.tag))
    const target = await findByAttribute('bp-target', 'target-2')
    const root = target.getRootNode() as ShadowRoot
    assert({
      given: 'dynamic render with default styles from template',
      should: 'have adoptedStyleSheets of length 2',
      actual: root.adoptedStyleSheets.length,
      expected: 2,
    })
  },
}