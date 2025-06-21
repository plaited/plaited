import { test, expect } from 'bun:test'
import { type TemplateObject, defineElement, css } from 'plaited'
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

const NestedCustomElement = defineElement({
  tag: 'nested-component',
  shadowDom: (
    <>
      <span
        {...styles.nestedLabel}
        part='span'
      >
        inside nested template
      </span>
      <slot name='nested' />
    </>
  ),
})

test('createTemplate: CustomElement hoisting its styles and parts', () => {
  const el = <NestedCustomElement />
  expect({
    content: render(el),
    stylesheets: el.stylesheets,
    parts: el.parts,
  }).toMatchSnapshot()
})

test('createTemplate: CustomElement with declarative shadow dom & hoist styles and part', () => {
  const el = (
    <NestedCustomElement
      {...styles.nestedComponent}
      part='nested-component S1'
    />
  )
  expect({
    content: render(el),
    stylesheets: el.stylesheets,
    parts: el.parts,
  }).toMatchSnapshot()
})

test('createTemplate: CustomElement with styled slotted component', () => {
  const el = (
    <NestedCustomElement {...styles.slottedParagraph}>
      <p
        slot='nested'
        part='S2 paragraph'
      >
        slotted paragraph
      </p>
    </NestedCustomElement>
  )
  expect({ content: render(el), stylesheets: el.stylesheets, parts: el.parts }).toMatchSnapshot()
})

const TopCustomElement = defineElement({
  tag: 'top-component',
  shadowDom: (
    <NestedCustomElement {...styles.slottedParagraph}>
      <p
        slot='nested'
        part='paragraph S2'
      >
        slotted paragraph
      </p>
    </NestedCustomElement>
  ),
})

test('createTemplate: CustomElement with declarative shadow dom and nested declarative shadow dom', () => {
  const el = <TopCustomElement part='S3' />
  expect({ content: render(el), stylesheets: el.stylesheets, parts: el.parts }).toMatchSnapshot()
})

test('createTemplate: CustomElement with declarative shadow dom and nested declarative shadow dom plus host styles', () => {
  const el = <TopCustomElement {...styles.topComponent} />
  expect({
    content: render(el),
    stylesheets: el.stylesheets,
    parts: el.parts,
  }).toMatchSnapshot()
})

test('createTemplate: CustomElement with declarative shadow dom and nested declarative shadow dom plus host styles and child', () => {
  const el = (
    <TopCustomElement {...styles.topComponent}>
      <img {...styles.image} />
    </TopCustomElement>
  )
  expect({ content: render(el), stylesheets: el.stylesheets, parts: el.parts }).toMatchSnapshot()
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
  expect((<div {...css.assign(hoistStyles.var1, hoistStyles.var2, hoistStyles.var3)} />).stylesheets.length).toBe(2)
})

test('ssr: filters out falsey style object', () => {
  expect((<div {...css.assign(hoistStyles.var1, hoistStyles.var2, false, undefined, null)} />).stylesheets.length).toBe(
    1,
  )
})

test('ssr: Properly deduplicates duplicate part identifiers', () => {
  expect((<div part='S1 div S1' />).parts.length).toBe(2)
})
