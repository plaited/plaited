import { expect, test } from 'bun:test'
import beautify from 'beautify'
import {
  createSSR,
  createStyles,
  DECORATOR_TEMPLATE_IDENTIFIER,
  decorateElements,
  joinStyles,
  type TemplateObject,
} from 'plaited/ui'

const render = (template: TemplateObject) => {
  const { render: ssrRender } = createSSR()
  return beautify(ssrRender(template), { format: 'html' })
}

const styles = createStyles({
  nestedLabel: {
    fontWeight: 'bold',
  },
  nestedElement: {
    display: 'flex',
    flexDirection: 'column',
  },
  slottedParagraph: {
    color: 'rebeccapurple',
  },
  topElement: {
    display: 'block',
  },
  image: {
    width: '100%',
    aspectRatio: '16 / 9',
  },
})

const NestedCustomElement = decorateElements({
  tag: 'nested-element',
  shadowDom: (
    <>
      <span {...styles.nestedLabel}>inside nested template</span>
      <slot name='nested' />
    </>
  ),
})

test('decorateElements: returns a DecoratorTemplate with $ identifier', () => {
  expect(NestedCustomElement.$).toBe(DECORATOR_TEMPLATE_IDENTIFIER)
})

test('decorateElements: hoists styles from shadow DOM', () => {
  const el = <NestedCustomElement />
  expect({
    content: render(el),
    stylesheets: el.stylesheets,
  }).toMatchSnapshot()
})

test('decorateElements: applies host styles via spread', () => {
  const el = <NestedCustomElement {...styles.nestedElement} />
  expect({
    content: render(el),
    stylesheets: el.stylesheets,
  }).toMatchSnapshot()
})

test('decorateElements: supports styled slotted children', () => {
  const el = (
    <NestedCustomElement {...styles.slottedParagraph}>
      <p slot='nested'>slotted paragraph</p>
    </NestedCustomElement>
  )
  expect({
    content: render(el),
    stylesheets: el.stylesheets,
  }).toMatchSnapshot()
})

const TopCustomElement = decorateElements({
  tag: 'top-element',
  shadowDom: (
    <NestedCustomElement {...styles.slottedParagraph}>
      <p slot='nested'>slotted paragraph</p>
    </NestedCustomElement>
  ),
})

test('decorateElements: supports nested declarative shadow DOM', () => {
  const el = <TopCustomElement />
  expect({
    content: render(el),
    stylesheets: el.stylesheets,
  }).toMatchSnapshot()
})

test('decorateElements: nested DSD with host styles', () => {
  const el = <TopCustomElement {...styles.topElement} />
  expect({
    content: render(el),
    stylesheets: el.stylesheets,
  }).toMatchSnapshot()
})

test('decorateElements: nested DSD with host styles and light DOM child', () => {
  const el = (
    <TopCustomElement {...styles.topElement}>
      {/* biome-ignore lint/a11y/useAltText: Test fixture doesn't need alt text */}
      <img {...styles.image} />
    </TopCustomElement>
  )
  expect({
    content: render(el),
    stylesheets: el.stylesheets,
  }).toMatchSnapshot()
})

const hoistStyles = createStyles({
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

test('decorateElements: hoists multiple stylesheets per node (dedup happens at consumption)', () => {
  expect((<div {...joinStyles(hoistStyles.var1, hoistStyles.var2, hoistStyles.var3)} />).stylesheets.length).toBe(3)
})
