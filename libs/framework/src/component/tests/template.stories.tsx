import { assert, findByAttribute, findByText } from '@plaited/storybook-rite'
import { Meta, StoryObj } from '@plaited/storybook'
import { createStyles } from '../../index.js'
import { Component } from '../component.js'
import { canUseDOM } from '@plaited/utils'

const meta: Meta = {
  title: 'Tests/template',
  component: () => <></>,
}

export default meta

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

const createTemplateElement = (content: string) => {
  const fragment = parser.parseFromString(`<template>${content}</template>`, 'text/html', {
    includeShadowRoots: true,
  })
  return fragment.head.firstChild as HTMLTemplateElement
}

export const noDeclarativeShadowDom: StoryObj = {
  play: async ({ canvasElement }) => {
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
    const host = document.createElement(Fixture.tag)
    canvasElement.append(host)
    const inner = await findByAttribute('data-test', 'content')
    const textContent = inner.textContent
    assert({
      given: 'Appending template-element',
      should: 'have a div with content',
      actual: textContent,
      expected: content,
    })
    assert({
      given: 'Appending template-element',
      should: 'have constructable adoptedStyleSheets',
      actual: host.shadowRoot.adoptedStyleSheets.length,
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
    canvasElement.append(template.content)
    const host = await findByAttribute<HTMLElement>('bp-target', 'host')
    let inner = await findByAttribute('bp-target', 'inner', host)
    const style = await findByText(styles.inner.stylesheet.join(' '), host)
    let textContent = inner.textContent
    assert({
      given: 'before registering custom element',
      should: 'have style tag',
      actual: style.textContent,
      expected: styles.inner.stylesheet.join(' '),
    })
    assert({
      given: 'before registering custom element',
      should: 'pre-hydration text content',
      actual: textContent,
      expected: 'before hydration',
    })
    let computedStyle = window.getComputedStyle(inner)
    let color = computedStyle.color
    assert({
      given: 'before registering custom element',
      should: 'color of inner should be red',
      actual: color,
      expected: 'rgb(255, 0, 0)',
    })
    Fixture.define()
    inner = await findByAttribute('bp-target', 'inner', host)
    textContent = inner.textContent
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
