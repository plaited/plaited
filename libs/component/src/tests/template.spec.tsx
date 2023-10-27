import { test } from '@plaited/rite'
import { css, ssr, FT } from '@plaited/jsx'
import { createComponent } from '../index.js'
import { createTemplateElement } from '../sugar.js'



test('template', async t => {
  const [ cls, stylesheet ] = css`
  .inner {
    color: blue
  }`
  const content = 'client side rendered'
  const Template = createComponent(
    { tag:'template-element' },
    base => class extends base {
      static template = <div
        data-test='content'
        className={cls.inner}
        {...stylesheet}
      >
        {content}
      </div>
    }
  )
  Template()
  const body = document.querySelector('body')
  const tplEl = document.createElement(Template.tag)
  body.append(tplEl)
  const inner = await t.findByAttribute('data-test', 'content')
  const style = await t.findByText(stylesheet.stylesheet)
  const textContent = inner.textContent
  t({
    given: 'setting template entity',
    should: 'append div',
    actual: textContent,
    expected: content,
  })
  t({
    given: 'setting template entity',
    should: 'have style tag',
    actual: style.tagName,
    expected: 'STYLE',
  })
})

test('template existing declarative shadowdom', async t => {
  const [ cls, stylesheet ] = css`
  .hydrated {
    color: red
  }`
  const Template:FT = ({ stylesheet, children }) => <div
    data-test='inner'
    className={cls.hydrated}
    stylesheet={stylesheet}
  >
    {children}
  </div>
  const Fixture = createComponent(
    { tag:'with-declarative-shadow-dom' },
    base => class extends base {
      static template = <Template {...stylesheet}>after hydration</Template>
    }
  )
  const template = createTemplateElement(ssr(
    <Fixture.tag data-test='host'>
      <Template>before hydration</Template>
    </Fixture.tag>
  ))
  const frag = document.importNode(template.content, true)
  const body = document.querySelector('body')
  body.append(frag)
  const host = await t.findByAttribute<HTMLElement>('data-test', 'host')
  let inner = await t.findByAttribute('data-test', 'inner', host)
  let style = await t.findByText(stylesheet.stylesheet, host)
  let textContent = inner.textContent
  t({
    given: 'before registering',
    should: 'not have style tag',
    actual: style,
    expected: undefined,
  })
  t({
    given: 'setting template entity',
    should: 'append div',
    actual: textContent,
    expected: 'before hydration',
  })
  Fixture()
  inner = await t.findByAttribute('data-test', 'inner', host)
  style = await t.findByText(stylesheet.stylesheet, host)
  t({
    given: 'setting template entity',
    should: 'have style tag',
    actual: style.tagName,
    expected: 'STYLE',
  })
  textContent = inner.textContent
  t({
    given: 'setting template entity',
    should: 'append div',
    actual: textContent,
    expected: 'after hydration',
  })
})


