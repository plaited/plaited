import { assert, findByAttribute, findByText } from '@plaited/storybook-rite'
import { Meta, StoryObj } from '@plaited/storybook'
import { PlaitedElement, createStyles } from '../../index.js'
import { Component } from '../component.js'
import { createTemplate } from '../../jsx/create-template.js'
const meta: Meta = {
  title: 'Tests/template',
  component: () => <></>,
}

export default meta

const styles = createStyles({
  inner: {
    color: 'blue',
  },
})
const content = 'client side rendered'

const Fixture = Component({
  tag: 'template-element',
  template: (
    <div
      data-test='content'
      {...styles.inner}
    >
      {content}
    </div>
  ),
})

export const noDeclarativeShadowDom: StoryObj = {
  render: () => <Fixture />,
  play: async () => {
    const host = document.querySelector(Fixture.tag)
    const inner = await findByAttribute('data-test', 'content')
    const textContent = inner?.textContent
    assert({
      given: 'Appending template-element',
      should: 'have a div with content',
      actual: textContent,
      expected: content,
    })
    assert({
      given: 'Appending template-element',
      should: 'have constructable adoptedStyleSheets',
      actual: host?.shadowRoot?.adoptedStyleSheets.length,
      expected: 1,
    })
  },
}

export const withDeclarativeShadowDom: StoryObj = {
  play: async ({ canvasElement }) => {
    const styles = createStyles({
      inner: {
        color: 'red',
      },
      span: {
        color: 'green',
      },
    })
    const Content = () => (
      <div
        bp-target='inner'
        {...styles.inner}
      >
        before hydration
      </div>
    )
    const tag = 'with-declarative-shadow-dom'
    const template = createTemplate(tag, {
      'bp-target': 'host',
      children: (
        <template
          shadowrootmode='open'
          shadowrootdelegatesfocus
        >
          <Content />
        </template>
      ),
    }).server.join('')

    // @ts-ignore: new dom api
    canvasElement.setHTMLUnsafe(template)

    const host = await findByAttribute<PlaitedElement>('bp-target', 'host')
    let inner = await findByAttribute('bp-target', 'inner', host)
    const style = await findByText(styles.inner.stylesheet.join(' '), host)
    let textContent = inner?.textContent
    assert({
      given: 'before registering custom element',
      should: 'have style tag',
      actual: style?.textContent,
      expected: styles.inner.stylesheet.join(' '),
    })
    assert({
      given: 'before registering custom element',
      should: 'pre-hydration text content',
      actual: textContent,
      expected: 'before hydration',
    })
    // @ts-expect-error: allow it to error
    let computedStyle = window.getComputedStyle(inner)
    let color = computedStyle.color
    assert({
      given: 'before registering custom element',
      should: 'color of inner should be red',
      actual: color,
      expected: 'rgb(255, 0, 0)',
    })
    Component({
      tag,
      publicEvents: ['render'],
      template: <Content />,
      bp({ $ }) {
        return {
          render() {
            const [inner] = $('inner')
            inner.render(<span stylesheet={styles.span.stylesheet}>after hydration</span>)
            inner.attr('class', styles.span.className)
          },
        }
      },
    })
    host?.trigger({ type: 'render' })

    inner = await findByAttribute('bp-target', 'inner', host)
    textContent = inner?.textContent
    // @ts-expect-error: allow it to error
    computedStyle = window.getComputedStyle(inner)
    color = computedStyle.color
    assert({
      given: 'after registering custom element',
      should: 'have post hydration text content',
      actual: textContent,
      expected: 'after hydration',
    })
    assert({
      given: 'before registering custom element',
      should: 'color of inner should be green',
      actual: color,
      expected: 'rgb(0, 128, 0)',
    })
  },
}
