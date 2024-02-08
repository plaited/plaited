import { test } from '@plaited/rite'
import { css } from '../../css.js'
import { Component } from '../index.js'
import { canUseDOM } from '@plaited/utils'

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

test('template', async (t) => {
  const { $stylesheet, ...cls } = css`
    .inner {
      color: blue;
    }
  `
  const content = 'client side rendered'
  const Fixture = Component({
    tag: 'template-element',
    template: (
      <div
        data-test='content'
        className={cls.inner}
        stylesheet={$stylesheet}
      >
        {content}
      </div>
    ),
  })
  Fixture.define()
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

test('template existing declarative shadowdom', async (t) => {
  const { $stylesheet, ...cls } = css`
    .inner {
      color: red;
    }
  `
  const Fixture = Component({
    tag: 'with-declarative-shadow-dom',
    template: (
      <div
        bp-target='inner'
        className={cls.inner}
        stylesheet={$stylesheet}
      >
        before hydration
      </div>
    ),
    bp({ $ }) {
      const { $stylesheet, ...cls2 } = css`
        .span {
          color: green;
        }
      `
      const [inner] = $('inner')
      inner.render(<span stylesheet={$stylesheet}>after hydration</span>)
      inner.attr('class', `${cls2.span} ${cls.inner}`)
    },
  })
  const template = createTemplateElement((<Fixture bp-target='host' />).server.join(''))
  const frag = document.importNode(template.content, true)
  const body = document.querySelector('body')
  body.append(frag)
  const host = await t.findByAttribute<HTMLElement>('bp-target', 'host')
  let inner = await t.findByAttribute('bp-target', 'inner', host)
  const style = await t.findByText($stylesheet, host)
  let textContent = inner.textContent
  t({
    given: 'before registering custom element',
    should: 'have style tag',
    actual: style.textContent,
    expected: $stylesheet,
  })
  t({
    given: 'before registering custom element',
    should: 'pre-hydration text content',
    actual: textContent,
    expected: 'before hydration',
  })
  let computedStyle = window.getComputedStyle(inner)
  let color = computedStyle.color
  t({
    given: 'before registering custom element',
    should: 'color of inner should be red',
    actual: color,
    expected: 'rgb(255, 0, 0)',
  })
  Fixture.define()
  inner = await t.findByAttribute('bp-target', 'inner', host)
  textContent = inner.textContent
  computedStyle = window.getComputedStyle(inner)
  color = computedStyle.color
  t({
    given: 'after registering custom element',
    should: 'have post hydration text content',
    actual: textContent,
    expected: 'after hydration',
  })
  t({
    given: 'before registering custom element',
    should: 'color of inner should be green',
    actual: color,
    expected: 'rgb(0, 128, 0)',
  })
})
