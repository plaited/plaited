import { test } from '@plaited/rite'
import { createStyles } from '../../css.js'
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
  const styles = createStyles({
    inner: {
      color: 'red',
    },
    span: {
      color: 'green',
    },
  })
  const Fixture = Component({
    tag: 'with-declarative-shadow-dom',
    template: (
      <div
        bp-target='inner'
        {...styles.inner}
      >
        before hydration
      </div>
    ),
    bp({ $ }) {
      const [inner] = $('inner')
      inner.render(<span stylesheet={styles.span.stylesheet}>after hydration</span>)
      inner.attr('class', styles.span.className)
    },
  })
  const template = createTemplateElement((<Fixture bp-target='host' />).server.join(''))
  const frag = document.importNode(template.content, true)
  const body = document.querySelector('body')
  body.append(frag)
  const host = await t.findByAttribute<HTMLElement>('bp-target', 'host')
  let inner = await t.findByAttribute('bp-target', 'inner', host)
  const style = await t.findByText(styles.inner.stylesheet.join(' '), host)
  let textContent = inner.textContent
  t({
    given: 'before registering custom element',
    should: 'have style tag',
    actual: style.textContent,
    expected: styles.inner.stylesheet.join(' '),
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
