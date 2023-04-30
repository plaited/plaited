import {
  createTemplate as h,
  css,
  Fragment,
  PlaitedElement,
  ssr,
} from '../index.js'

test('ssr: renders createTemplate', () =>
  expect(
    ssr(
      h('div', {
        style: { backgroundColor: 'blue', margin: '12px' },
        children: 'styles',
      })
    )
  ).toMatchSnapshot())

test('ssr: renders Fragment', () => {
  expect(
    ssr(h(Fragment, {
      children: Array.from(Array(10).keys()).map(n =>
        h('li', { children: `item-${n}` })
      ),
    }))
  ).toMatchSnapshot()
})

const span = css`
  .nested-label {
    font-weight: bold;
  }
`

const NestedCustomElement: PlaitedElement = ({ children, stylesheet }) =>
  h('nested-component', {
    slots: children,
    stylesheet,
    children: [
      h('span', {
        className: span[0]['nested-label'],
        ...span[1],
        children: 'inside nested template',
      }),
      h('slot', { name: 'nested' }),
    ],
  })

const slotted = css`
  .slotted-paragraph {
    color: rebeccapurple;
  }
`

const TopCustomElement: PlaitedElement = ({ children, stylesheet }) =>
  h('top-component', {
    stylesheet,
    slots: children,
    children: h(NestedCustomElement, {
      children: h(
        'p',
        {
          slot: 'nested',
          className: slotted[0]['slotted-paragraph'],
          ...slotted[1],
          children: 'slotted paragraph',
        }
      ),
    }),
  })

const top = css`
  :host {
    display: block;
  }
`

const testEl = css`
  .image {
    width: 100%;
    aspect-ratio: 16 / 9;
  }
`

test('ssr: renders styles before markup when no body or head tag', () => {
  expect(
    ssr(
      h(TopCustomElement, {
        ...top[1],
        children: h('img', { className: testEl[0].image, ...testEl[1] }),
      })
    )
  ).toMatchSnapshot()
})

test('ssr: renders styles in body when present', () => {
  expect(ssr(
    h('body', {
      children: h(TopCustomElement, {
        ...top[1],
        children: h('img', { className: testEl[0].image, ...testEl[1] }),
      }),
    })
  )).toMatchSnapshot()
})

test('ssr: renders styles in head when present', () => {
  expect(ssr(
    h('html', {
      children: [
        h('head', {}),
        h('body', {
          children: h(
            TopCustomElement,
            {
              ...top[1],
              children: h('img', { className: testEl[0].image, ...testEl[1] }),
            }
          ),
        }),
      ],
    })
  )).toMatchSnapshot()
})
