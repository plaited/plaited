import { test } from '@plaited/rite'
import { css } from '@plaited/jsx'
import { createComponent } from '../index.js'

const [ cls, stylesheet ] = css`
.inner {
  color: blue
}
`

test('template', async t => {
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
