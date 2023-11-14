import { test, expect } from 'bun:test'
import { createTemplate as h, css, Fragment, FT, Template } from '../index.js'
import { ssr } from '../ssr.js'
import beautify from 'beautify'

const render = (template: Template) => {
  return beautify(ssr(template), { format: 'html' })
}

test('ssr: self closing - html', () => {
  expect(render(h('input', { type: 'text' }))).toMatchSnapshot()
})

test('ssr: self closing - svg', () => {
  expect(render(h('polygon', { points: '0,100 50,25 50,75 100,0' }))).toMatchSnapshot()
})

test('ssr: falsey - undefined', () => {
  expect(render(h('div', { children: undefined }))).toMatchSnapshot()
})

test('ssr: falsey - null', () => {
  expect(render(h('div', { children: null }))).toMatchSnapshot()
})

test('ssr: falsey - false', () => {
  expect(render(h('div', { children: false }))).toMatchSnapshot()
})

test('ssr: falsey - ""', () => {
  expect(render(h('div', { children: '' }))).toMatchSnapshot()
})

test('ssr: falsey - 0', () => {
  expect(render(h('div', { children: 0 }))).toMatchSnapshot()
})

test('ssr: falsey - NaN', () => {
  expect(render(h('div', { children: NaN }))).toMatchSnapshot()
})

test('ssr: conditional', () => {
  expect(render(h('div', { children: true && 'hello' }))).toMatchSnapshot()
})

test('ssr: style attribute', () =>
  expect(
    render(h('div', {
      style: { backgroundColor: 'blue', margin: '12px' },
      children: 'styles',
    })),
  ).toMatchSnapshot())

test('ssr: data-trigger attribute', () =>
  expect(
    render(h('div', {
      'data-trigger': {
        click: 'random',
        focus: 'thing',
      },
      children: 'triggers',
    })),
  ).toMatchSnapshot())

test('ssr: camelCase attributes', () => {
  expect(
    render(h('div', {
      dataTrigger: { click: 'click' },
      dataAddress: 'address',
      dataMode: 'mode',
      xPrefix: 'x',
    })),
  ).toMatchSnapshot()
})

test('ssr: array of templates', () =>
  expect(
    render(h('div', {
      children: Array.from(Array(10).keys()).map((n) => h('li', { children: `${n}` })),
    })),
  ).toMatchSnapshot())

test('ssr: should throw with attribute starting with on', () => {
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

test('ssr: should not throw on script tag with trusted attribute', () => {
  expect(render(h('script', { type: 'module', src: 'main.js', trusted: true }))).toMatchSnapshot()
})

test('ssr: escapes children', () => {
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

test('ssr: does not escape children when trusted', () => {
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

test('ssr: with slotted templates', () => {
  const Cel: FT = ({ children }) => h('c-el', { slots: children, children: h('slot', { name: 'slot' }) })

  expect(
    render(h(Cel, {
      children: Array.from(Array(10).keys()).map((n) => h('li', { slot: 'slot', children: `slot-${n}` })),
    })),
  ).toMatchSnapshot()
})

test('ssr: Fragment of templates', () => {
  expect(
    render(h(Fragment, {
      children: Array.from(Array(10).keys()).map((n) => h('li', { children: `item-${n}` })),
    })),
  ).toMatchSnapshot()
})

const span = css`
  .nested-label {
    font-weight: bold;
  }
`

const NestedCustomElement: FT = ({ children, stylesheet }) =>
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

test('ssr: custom element with child hoisting its styles', () => {
  expect(render(h(NestedCustomElement, {}))).toMatchSnapshot()
})

const nested = css`
  host: {
    display: flex;
    flex-direction: column;
  }
`

test('ssr: custom element with child and host styles', () => {
  expect(render(h(NestedCustomElement, { ...nested[1] }))).toMatchSnapshot()
})

const slotted = css`
  .slotted-paragraph {
    color: rebeccapurple;
  }
`

test('ssr: custom element with styled slotted component', () => {
  expect(
    render(h(NestedCustomElement, {
      children: [
        h('p', {
          slot: 'nested',
          className: slotted[0]['slotted-paragraph'],
          ...slotted[1],
          children: 'slotted paragraph',
        }),
      ],
    })),
  ).toMatchSnapshot()
})

const TopCustomElement: FT = ({ children, stylesheet }) =>
  h('top-component', {
    stylesheet,
    slots: children,
    children: h(NestedCustomElement, {
      children: h('p', {
        slot: 'nested',
        className: slotted[0]['slotted-paragraph'],
        ...slotted[1],
        children: 'slotted paragraph',
      }),
    }),
  })

test('ssr: custom element with styles nested in custom element', () => {
  expect(render(h(TopCustomElement, {}))).toMatchSnapshot()
})

const top = css`
  :host {
    display: block;
  }
`

test('ssr: custom element with styles nested in custom element with styles', () => {
  expect(render(h(TopCustomElement, { ...top[1] }))).toMatchSnapshot()
})

const testEl = css`
  .image {
    width: 100%;
    aspect-ratio: 16 / 9;
  }
`

test('ssr: custom element with nested custom element and styled slotted element', () => {
  expect(
    render(h(TopCustomElement, {
      ...top[1],
      children: h('img', { className: testEl[0].image, ...testEl[1] }),
    })),
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

test('ssr: properly hoist and deduplicates multiple stylesheets on a single node', () => {
  expect(
    render(h('div', {
      stylesheet: [sheet1[1].stylesheet, sheet2[1].stylesheet, sheet3[1].stylesheet],
    })),
  ).toMatchSnapshot()
})

test('ssr: trims whitespace', () => {
  expect(
    render(h('div', {
      children: '   trims white-space    ',
    })),
  ).toMatchSnapshot()
})
