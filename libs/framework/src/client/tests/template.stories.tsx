import { assert, findByAttribute, findByText } from '@plaited/storybook-rite'
import { Meta, StoryObj } from '@plaited/storybook'
import { PlaitedElement, createStyles } from '../../index.js'
import { defineTemplate } from '../define-template.js'
import { createTemplate } from '../../jsx/create-template.js'
const meta: Meta = {
  title: 'Tests/template',
  component: () => <></>,
}

export default meta


export const defaultModeAndFocus: StoryObj = {
  render: () => {
    const ModeOpen = defineTemplate({
      tag: 'mode-open',
      shadowDom: <span>mode open and delegates focus</span>
    })
    return <ModeOpen p-target='el' />
  },
  play: async () => {
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
  }
}

export const delegatesFocusFalse: StoryObj = {
  render: () => {
    const DelegateFalse = defineTemplate({
      tag: 'delegate-false',
      delegatesFocus: false,
      shadowDom: <span>mode open and delegates focus</span>
    })
    return <DelegateFalse p-target='el' />
  },
  play: async () => {
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
  }
}

export const closedMode: StoryObj = {
  render: () => {
    const ClosedMode = defineTemplate({
      tag: 'mode-closed',
      mode: 'closed',
      shadowDom: <span>mode open and delegates focus</span>
    })
    return <ClosedMode p-target='el' />
  },
  play: async () => {
    const host = await findByAttribute<PlaitedElement>('p-target', 'el')
    console.log(host?.shadowRoot)
    assert({
      given: 'setHTMLUnsafe',
      should: 'return null',
      actual: host?.shadowRoot,
      expected: null,
    })
  }
}

export const hydration: StoryObj = {
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
        p-target='inner'
        {...styles.inner}
      >
        before hydration
      </div>
    )
    const tag = 'with-declarative-shadow-dom'
    const template = createTemplate(tag, {
      'p-target': 'host',
      children: (
        <template
          shadowrootmode='open'
          shadowrootdelegatesfocus
        >
          <Content />
        </template>
      ),
    }).html.join('')

    canvasElement.setHTMLUnsafe(template)

    const host = await findByAttribute<PlaitedElement>('p-target', 'host')
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
      tag,
      publicEvents: ['render'],
      shadowDom: <Content />,
      connectedCallback({ $ }) {
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
