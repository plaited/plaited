import type { StoryObj } from 'plaited/test'
import type { PlaitedElement } from '../plaited.types.js'
import { css } from '../../style/css.js'
import { defineTemplate } from '../define-template.js'
import { ModeOpen, DelegateFalse, ClosedMode } from './template.js'
export const defaultModeAndFocus: StoryObj = {
  template: () => <ModeOpen p-target='el' />,
  play: async ({ assert, findByAttribute }) => {
    const host = await findByAttribute<PlaitedElement>('p-target', 'el')
    assert({
      given: 'setHTMLUnsafe',
      should: 'delegate focus',
      actual: host?.shadowRoot?.delegatesFocus,
      expected: true,
    })
    assert({
      given: 'setHTMLUnsafe',
      should: 'delegate focus',
      actual: host?.shadowRoot?.mode,
      expected: 'open',
    })
  },
}

export const delegatesFocusFalse: StoryObj = {
  template: () => <DelegateFalse p-target='el' />,
  play: async ({ assert, findByAttribute }) => {
    const host = await findByAttribute<PlaitedElement>('p-target', 'el')
    assert({
      given: 'setHTMLUnsafe',
      should: 'delegate focus',
      actual: host?.shadowRoot?.delegatesFocus,
      expected: false,
    })
    assert({
      given: 'setHTMLUnsafe',
      should: 'delegate focus',
      actual: host?.shadowRoot?.mode,
      expected: 'open',
    })
  },
}

export const closedMode: StoryObj = {
  template: () => <ClosedMode p-target='el' />,
  play: async ({ assert, findByAttribute }) => {
    const host = await findByAttribute<PlaitedElement>('p-target', 'el')
    assert({
      given: 'setHTMLUnsafe',
      should: 'return null',
      actual: host?.shadowRoot,
      expected: null,
    })
  },
}

export const hydration: StoryObj = {
  play: async ({ assert, findByAttribute, findByText, hostElement }) => {
    const styles = css.create({
      inner: {
        color: 'red',
      },
      span: {
        color: 'green',
      },
    })
    const Content = () => (
      <div
        p-target='inner'
        {...styles.inner}
      >
        before hydration
      </div>
    )
    const Tag = 'with-declarative-shadow-dom'
    const template = (
      <Tag p-target='host'>
        <template
          shadowrootmode='open'
          shadowrootdelegatesfocus
        >
          <Content />
        </template>
      </Tag>
    )
    hostElement.setHTMLUnsafe(template.html.join(''))

    let host = await findByAttribute<PlaitedElement>('p-target', 'host')
    let inner = await findByAttribute('p-target', 'inner', host)
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
    defineTemplate({
      tag: Tag,
      publicEvents: ['render'],
      shadowDom: <Content />,
      bProgram({ $ }) {
        return {
          render() {
            const [inner] = $('inner')
            inner.render(<span stylesheet={styles.span.stylesheet}>after hydration</span>)
            inner.attr('class', styles.span.className)
          },
        }
      },
    })
    host = await findByAttribute<PlaitedElement>('p-target', 'host')
    host?.trigger({ type: 'render' })

    inner = await findByAttribute('p-target', 'inner', host)
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
