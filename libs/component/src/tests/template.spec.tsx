import { test } from '@plaited/rite'
import { css, h } from '@plaited/jsx'
import { Component } from '../index.js'

test('template', async (t) => {
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
        data-trigger={{
          click: 'click'
        }}
        {...stylesheet}
      >
        {Array.from(Array(10).keys()).map((n) => h('li', { children: `${n}` }))}
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

// test('template existing declarative shadowdom', async (t) => {
//   const [cls, stylesheet] = css`
//     .inner {
//       color: red;
//     }
//   `
//   const Template: FT = ({ stylesheet, children }) => (
//     <div
//       data-test='inner'
//       className={cls.inner}
//       stylesheet={stylesheet}
//     >
//       {children}
//     </div>
//   )
//   class Fixture extends Component({
//     tag: 'with-declarative-shadow-dom',
//     template: <Template>after hydration</Template>,
//   }) {}
//   const frag = 
//     (
//       <Fixture.tag
//         data-test='host'
//         {...stylesheet}
//       >
//         <Template>before hydration</Template>
//       </Fixture.tag>
//     ).node
//   const body = document.querySelector('body')
//   body.append(frag)
//   const host = await t.findByAttribute<HTMLElement>('data-test', 'host')
//   let inner = await t.findByAttribute('data-test', 'inner', host)
//   let style = await t.findByText(stylesheet.stylesheet, host)
//   let textContent = inner.textContent
//   t({
//     given: 'before registering custom element',
//     should: 'have style tag',
//     actual: style.textContent,
//     expected: stylesheet.stylesheet,
//   })
//   t({
//     given: 'before registering custom element',
//     should: 'pre-hydration text content',
//     actual: textContent,
//     expected: 'before hydration',
//   })
//   customElements.define(Fixture.tag, Fixture)
//   inner = await t.findByAttribute('data-test', 'inner', host)
//   style = await t.findByText(stylesheet.stylesheet, host)
//   t({
//     given: 'after registering custom element',
//     should: 'style tag should be undefined',
//     actual: style,
//     expected: undefined,
//   })
//   t({
//     given: 'after registering custom element',
//     should: 'have a constructable stylesheet',
//     actual: host.shadowRoot.adoptedStyleSheets.length,
//     expected: 0,
//   })
//   textContent = inner.textContent
//   t({
//     given: 'after registering custom element',
//     should: 'have post hydration text content',
//     actual: textContent,
//     expected: 'after hydration',
//   })
// })
