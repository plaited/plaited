import { test } from '@plaited/rite'
import { css, FT } from '@plaited/jsx'
import { Component } from '../index.js'
import { canUseDOM } from '@plaited/utils'
test('PlaitedComponent Function Template CSR', async (t) => {
  const [cls, stylesheet] = css`
    .inner {
      color: blue;
    }
  `
  const content = 'client side rendered'
  class Fixture extends Component({
    tag: 'template-element',
    template: (
      <div
        data-test='content'
        className={cls.inner}
        {...stylesheet}
      >
        {content}
      </div>
    ),
  }) {}
  customElements.define(Fixture.tag, Fixture)
  const body = document.querySelector('body')
  const host = document.createElement(Fixture.tag)
  body.append(host)
  const inner = await t.findByAttribute('data-test', 'content')
  const textContent = inner.textContent
  t({
    given: 'Appending template-element',
    should: 'have a div with content',
    actual: textContent,
    expected: content,
  })
  t({
    given: 'Appending template-element',
    should: 'have constructable adoptedStyleSheets',
    actual: host.shadowRoot.adoptedStyleSheets.length,
    expected: 1,
  })
})

let parser: {
  parseFromString(
    string: string,
    type: DOMParserSupportedType,
    options: {
      includeShadowRoots: boolean
    },
  ): Document
}

if (canUseDOM()) {
  parser = new DOMParser()
}

export const createTemplateElement = (content: string) => {
  const fragment = parser.parseFromString(`<template>${content}</template>`, 'text/html', {
    includeShadowRoots: true,
  })
  return fragment.head.firstChild as HTMLTemplateElement
}

test('PlaitedComponent Function Template SSR With hydration Simulation', async (t) => {
  const [cls, stylesheet] = css`
    .inner {
      color: red;
    }
  `
  class Fixture extends Component({
    tag: 'with-declarative-shadow-dom',
    template: <div
    data-test='inner'
    className={cls.inner}
    {...stylesheet}
  >
    <slot data-test='slot'>before hydration</slot>
  </div>,
  }) {}
  const frag = (
    <Fixture.template 
      data-test='host'
      {...stylesheet}
    />
  ).string
  const body = document.querySelector('body')
  body.append(createTemplateElement(frag).content)
  const host = await t.findByAttribute<HTMLElement>('data-test', 'host')
  const inner = await t.findByAttribute('data-test', 'inner', host)
  let style = await t.findByText(stylesheet.stylesheet, host)
  const textContent = inner.textContent
  t({
    given: 'before registering custom element',
    should: 'have style tag',
    actual: style.textContent,
    expected: stylesheet.stylesheet,
  })
  t({
    given: 'before registering custom element',
    should: 'pre-hydration text content',
    actual: textContent,
    expected: 'before hydration',
  })
  customElements.define(Fixture.tag, Fixture)
  host.append('after hydration')
  style = await t.findByText(stylesheet.stylesheet, host)
  t({
    given: 'after registering custom element',
    should: 'style tag should be undefined',
    actual: style,
    expected: undefined,
  })
  t({
    given: 'after registering custom element',
    should: 'have a constructable stylesheet',
    actual: host.shadowRoot.adoptedStyleSheets.length,
    expected: 1,
  })
})
