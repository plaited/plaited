import { test, expect } from 'bun:test'
import { createTemplate as h, css, Fragment, FT, Template } from '../index.js'
import { ssr } from '../ssr.js'
import beautify from 'beautify'

const render = (template: Template) => {
  return beautify(ssr(template), { format: 'html' })
}

test('ssr: Self closing - html', () => {
  expect(render(h('input', { type: 'text' }))).toMatchSnapshot()
})

test('ssr: Self closing - svg', () => {
  expect(render(h('polygon', { points: '0,100 50,25 50,75 100,0' }))).toMatchSnapshot()
})

test('ssr: Falsey - undefined', () => {
  expect(render(h('div', { children: undefined }))).toMatchSnapshot()
})

test('ssr: Falsey - null', () => {
  expect(render(h('div', { children: null }))).toMatchSnapshot()
})

test('ssr: Falsey - false', () => {
  expect(render(h('div', { children: false }))).toMatchSnapshot()
})

test('ssr: Falsey - ""', () => {
  expect(render(h('div', { children: '' }))).toMatchSnapshot()
})

test('ssr: Falsey - 0', () => {
  expect(render(h('div', { children: 0 }))).toMatchSnapshot()
})

test('ssr: Falsey - NaN', () => {
  expect(render(h('div', { children: NaN }))).toMatchSnapshot()
})

test('ssr: Bad template - NaN', () => {
  expect(render(h('div', { children: { string: 'string' } }))).toMatchSnapshot()
})

test('ssr: Conditional', () => {
  expect(render(h('div', { children: true && 'hello' }))).toMatchSnapshot()
})

test('ssr: Style attribute', () =>
  expect(
    render(
      h('div', {
        style: { backgroundColor: 'blue', margin: '12px', '--cssVar': 'red' },
        children: 'styles',
      }),
    ),
  ).toMatchSnapshot())

test('ssr: data-trigger attribute', () =>
  expect(
    render(
      h('div', {
        'data-trigger': {
          click: 'random',
          focus: 'thing',
        },
        children: 'triggers',
      }),
    ),
  ).toMatchSnapshot())

test('ssr: kebab-case attributes', () => {
  expect(
    render(
      h('div', {
        dataTrigger: { click: 'click' },
        dataAddress: 'address',
        dataMode: 'mode',
        xPrefix: 'x',
      }),
    ),
  ).toMatchSnapshot()
})

test('ssr: Array of templates', () =>
  expect(
    render(
      h('ul', {
        children: Array.from(Array(10).keys()).map((n) => h('li', { children: `${n}` })),
      }),
    ),
  ).toMatchSnapshot())

test('ssr: Should throw with attribute starting with on', () => {
  expect(() => {
    h('div', {
      children: h('template', {
        shadowrootmode: 'closed',
        children: h('img', {
          src: 'nonexistent.png',
          onerror: "alert('xss!')",
        }),
      }),
    })
  }).toThrow()
})

test('ssr: should throw on script tag', () => {
  expect(() => {
    h('script', { type: 'module', src: 'main.js' })
  }).toThrow()
})

test('ssr: Should not throw on script tag with trusted attribute', () => {
  expect(render(h('script', { type: 'module', src: 'main.js', trusted: true }))).toMatchSnapshot()
})

test('ssr: Escapes children', () => {
  const scriptContent = `<script type="text/javascript">
const hostRegex = /^https?://([^/]+)/.*$/i;
const host = document.URL.replace(hostRegex, '$1');
const socket = new WebSocket(/);
const reload = () =>{
  location.reload();
  console.log('...reloading');
};
socket.addEventListener('message', reload);
console.log('[plaited] listening for file changes');
</script>`

  expect(render(h('div', { children: scriptContent }))).toMatchSnapshot()
})

test('ssr: Does not escape children when trusted', () => {
  const scriptContent = `<script type="text/javascript">
const hostRegex = /^https?://([^/]+)/.*$/i;
const host = document.URL.replace(hostRegex, '$1');
const socket = new WebSocket(/);
const reload = () =>{
  location.reload();
  console.log('...reloading');
};
socket.addEventListener('message', reload);
console.log('[plaited] listening for file changes');
</script>`

  expect(render(h('div', { trusted: true, children: scriptContent }))).toMatchSnapshot()
})

const Template: FT = (attrs) => h('template', attrs)

test('ssr: Non declarative shadow DOM template', () => {
  const List: FT = ({ children }) =>
    h('ul', {
      children: [
        Template({ children: h('span', { children: 'I am a span!!!' }) }),
        ...(Array.isArray(children) ? children : [children]),
      ],
    })

  expect(
    render(
      h(List, {
        children: Array.from(Array(10).keys()).map((n) => h('li', { children: `item-${n}` })),
      }),
    ),
  ).toMatchSnapshot()
})

test('ssr: Fragment', () => {
  expect(
    render(
      h(Fragment, {
        children: Array.from(Array(6).keys())
          .reverse()
          .map((n) => h('li', { children: n > 0 ? `In ${n}` : 'Blast Off!!!' })),
      }),
    ),
  ).toMatchSnapshot()
})

const nestedDeclarativeStyles = css`
  .nested-label {
    font-weight: bold;
  }
`

const NestedCustomElement: FT = ({ children, stylesheet }) =>
  h('nested-component', {
    stylesheet,
    children: [
      Template({
        shadowrootmode: 'open',
        shadowrootdelegatesfocus: true,
        children: [
          h('span', {
            className: nestedDeclarativeStyles[0]['nested-label'],
            ...nestedDeclarativeStyles[1],
            children: 'inside nested template',
          }),
          h('slot', { name: 'nested' }),
        ],
      }),
      ...(Array.isArray(children) ? children : [children]),
    ],
  })

test('ssr: Declarative shadow dom hoisting its styles', () => {
  expect(render(h(NestedCustomElement, {}))).toMatchSnapshot()
})

const nestedHostStyles = css`
  host: {
    display: flex;
    flex-direction: column;
  }
`

test('ssr: Declarative shadow dom with host styles', () => {
  expect(render(h(NestedCustomElement, { ...nestedHostStyles[1] }))).toMatchSnapshot()
})

const nestedChildrenStyles = css`
  .slotted-paragraph {
    color: rebeccapurple;
  }
`

test('ssr: Declarative shadow dom with styled slotted component', () => {
  expect(
    render(
      h(NestedCustomElement, {
        children: [
          h('p', {
            slot: 'nested',
            className: nestedChildrenStyles[0]['slotted-paragraph'],
            ...nestedChildrenStyles[1],
            children: 'slotted paragraph',
          }),
        ],
      }),
    ),
  ).toMatchSnapshot()
})

const TopCustomElement: FT = ({ children, stylesheet }) =>
  h('top-component', {
    stylesheet,
    children: [
      Template({
        shadowrootdelegatesfocus: true,
        shadowrootmode: 'open',
        children: h(NestedCustomElement, {
          children: h('p', {
            slot: 'nested',
            className: nestedChildrenStyles[0]['slotted-paragraph'],
            ...nestedChildrenStyles[1],
            children: 'slotted paragraph',
          }),
        }),
      }),
      ...(Array.isArray(children) ? children : [children]),
    ],
  })

test('ssr: Declarative shadow dom with another declarative shadow dom', () => {
  expect(render(h(TopCustomElement, {}))).toMatchSnapshot()
})

const hostStyles = css`
  :host {
    display: block;
  }
`

test('ssr: Declarative shadow dom with another declarative shadow dom plus host styles', () => {
  expect(render(h(TopCustomElement, { ...hostStyles[1] }))).toMatchSnapshot()
})

const imageStyles = css`
  .image {
    width: 100%;
    aspect-ratio: 16 / 9;
  }
`

test('ssr: Declarative shadow dom with another declarative shadow dom plus host styles and child', () => {
  expect(
    render(
      h(TopCustomElement, {
        ...hostStyles[1],
        children: h('img', { className: imageStyles[0].image, ...imageStyles[1] }),
      }),
    ),
  ).toMatchSnapshot()
})

const sheet1 = css`
  .a {
    width: 100%;
  }
`
const sheet2 = css`
  .a {
    width: 100%;
  }
`

const sheet3 = css`
  .a {
    color: blue;
  }
`

test('ssr: Properly hoist and deduplicates multiple stylesheets on a single node', () => {
  expect(
    render(
      h('div', {
        stylesheet: [sheet1[1].stylesheet, sheet2[1].stylesheet, sheet3[1].stylesheet],
      }),
    ),
  ).toMatchSnapshot()
})

test('ssr: Trims whitespace', () => {
  expect(
    render(
      h('div', {
        children: '   trims white-space    ',
      }),
    ),
  ).toMatchSnapshot()
})
