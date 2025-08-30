import { test, expect } from 'bun:test'
import { type TemplateObject, bElement } from 'plaited'
import * as css from 'plaited/css'
import beautify from 'beautify'

const render = (tpl: TemplateObject) => beautify(tpl.html.join(''), { format: 'html' })

const styles = css.create({
  nestedLabel: {
    fontWeight: 'bold',
  },
  nestedComponent: {
    display: 'flex',
    flexDirection: 'column',
  },
  slottedParagraph: {
    color: 'rebeccapurple',
  },
  topComponent: {
    display: 'block',
  },
  image: {
    width: '100%',
    aspectRatio: '16 / 9',
  },
})

const NestedCustomElement = bElement({
  tag: 'nested-component',
  shadowDom: (
    <>
      <span {...styles.nestedLabel}>inside nested template</span>
      <slot name='nested' />
    </>
  ),
})

test('createTemplate: CustomElement hoisting its styles', () => {
  const el = <NestedCustomElement />
  expect({
    content: render(el),
    stylesheets: el.stylesheets,
  }).toMatchSnapshot()
})

test('createTemplate: CustomElement with declarative shadow dom & hoist styles', () => {
  const el = <NestedCustomElement {...styles.nestedComponent} />
  expect({
    content: render(el),
    stylesheets: el.stylesheets,
  }).toMatchSnapshot()
})

test('createTemplate: CustomElement with styled slotted component', () => {
  const el = (
    <NestedCustomElement {...styles.slottedParagraph}>
      <p slot='nested'>slotted paragraph</p>
    </NestedCustomElement>
  )
  expect({ content: render(el), stylesheets: el.stylesheets }).toMatchSnapshot()
})

const TopCustomElement = bElement({
  tag: 'top-component',
  shadowDom: (
    <NestedCustomElement {...styles.slottedParagraph}>
      <p slot='nested'>slotted paragraph</p>
    </NestedCustomElement>
  ),
})

test('createTemplate: CustomElement with declarative shadow dom and nested declarative shadow dom', () => {
  const el = <TopCustomElement />
  expect({ content: render(el), stylesheets: el.stylesheets }).toMatchSnapshot()
})

test('createTemplate: CustomElement with declarative shadow dom and nested declarative shadow dom plus host styles', () => {
  const el = <TopCustomElement {...styles.topComponent} />
  expect({
    content: render(el),
    stylesheets: el.stylesheets,
  }).toMatchSnapshot()
})

test('createTemplate: CustomElement with declarative shadow dom and nested declarative shadow dom plus host styles and child', () => {
  const el = (
    <TopCustomElement {...styles.topComponent}>
      <img {...styles.image} />
    </TopCustomElement>
  )
  expect({ content: render(el), stylesheets: el.stylesheets }).toMatchSnapshot()
})

const hoistStyles = css.create({
  var1: {
    width: '100%',
  },
  var2: {
    width: '100%',
  },
  var3: {
    color: 'blue',
  },
})

test('ssr: Properly hoist and deduplicates multiple stylesheets on a single node', () => {
  expect((<div {...css.join(hoistStyles.var1, hoistStyles.var2, hoistStyles.var3)} />).stylesheets.length).toBe(2)
})
