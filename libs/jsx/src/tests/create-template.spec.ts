import { test, expect } from 'bun:test'
import { createTemplate as h, css, Fragment, FT, Template } from '../index.js'
import beautify from 'beautify'

const render = (tpl: Template) => {
  const template = document.createElement('template')
  template.content.append(tpl.node)
  return beautify(template.innerHTML, { format: 'html' })
}

test('createTemplate: self closing - html', () => {
  expect(render(h('input', { type: 'text' }))).toMatchSnapshot()
})

test('createTemplate: self closing - svg', () => {
  expect(render(h('polygon', { points: '0,100 50,25 50,75 100,0' }))).toMatchSnapshot()
})

test('createTemplate: falsey - undefined', () => {
  expect(render(h('div', { children: undefined }))).toMatchSnapshot()
})

test('createTemplate: falsey - null', () => {
  expect(render(h('div', { children: null }))).toMatchSnapshot()
})

test('createTemplate: falsey - false', () => {
  expect(render(h('div', { children: false }))).toMatchSnapshot()
})

test('createTemplate: falsey - ""', () => {
  expect(render(h('div', { children: '' }))).toMatchSnapshot()
})

test('createTemplate: falsey - 0', () => {
  expect(render(h('div', { children: 0 }))).toMatchSnapshot()
})

test('createTemplate: falsey - NaN', () => {
  expect(render(h('div', { children: NaN }))).toMatchSnapshot()
})

test('createTemplate: conditional', () => {
  expect(render(h('div', { children: true && 'hello' }))).toMatchSnapshot()
})

test('createTemplate: style attribute', () =>
  expect(
    render(h('div', {
      style: { backgroundColor: 'blue', margin: '12px' },
      children: 'styles',
    })),
  ).toMatchSnapshot())

test('createTemplate: data-trigger attribute', () =>
  expect(
    render(h('div', {
      'data-trigger': {
        click: 'random',
        focus: 'thing',
      },
      children: 'triggers',
    })),
  ).toMatchSnapshot())

test('createTemplate: camelCase attributes', () => {
  expect(
    render(h('div', {
      dataTrigger: { click: 'click' },
      dataAddress: 'address',
      dataMode: 'mode',
      xPrefix: 'x',
    })),
  ).toMatchSnapshot()
})

test('createTemplate: array of templates', () =>
  expect(
    render(h('div', {
      children: Array.from(Array(10).keys()).map((n) => h('li', { children: `${n}` })),
    })),
  ).toMatchSnapshot())

test('createTemplate: should throw with attribute starting with on', () => {
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

test('createTemplate: should throw on script tag', () => {
  expect(() => {
    h('script', { type: 'module', src: 'main.js' })
  }).toThrow()
})

test('createTemplate: should not throw on script tag with trusted attribute', () => {
  expect(render(h('script', { type: 'module', src: 'main.js', trusted: true }))).toMatchSnapshot()
})

test('createTemplate: escapes children', () => {
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

test('createTemplate: does not escape children when trusted', () => {
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

test('createTemplate: with slotted templates', () => {
  const Cel: FT = ({ children }) => h('c-el', { slots: children, children: h('slot', { name: 'slot' }) })

  expect(
    render(h(Cel, {
      children: Array.from(Array(10).keys()).map((n) => h('li', { slot: 'slot', children: `slot-${n}` })),
    })),
  ).toMatchSnapshot()
})

test('createTemplate: Fragment of templates', () => {
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

test('createTemplate: custom element with child hoisting its styles', () => {
  expect(render(h(NestedCustomElement, {}))).toMatchSnapshot()
})

const nested = css`
  host: {
    display: flex;
    flex-direction: column;
  }
`

test('createTemplate: custom element with child and host styles', () => {
  expect(render(h(NestedCustomElement, { ...nested[1] }))).toMatchSnapshot()
})

const slotted = css`
  .slotted-paragraph {
    color: rebeccapurple;
  }
`

test('createTemplate: custom element with styled slotted component', () => {
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

test('createTemplate: custom element with styles nested in custom element', () => {
  expect(render(h(TopCustomElement, {}))).toMatchSnapshot()
})

const top = css`
  :host {
    display: block;
  }
`

test('createTemplate: custom element with styles nested in custom element with styles', () => {
  expect(render(h(TopCustomElement, { ...top[1] }))).toMatchSnapshot()
})

const testEl = css`
  .image {
    width: 100%;
    aspect-ratio: 16 / 9;
  }
`

test('createTemplate: custom element with nested custom element and styled slotted element', () => {
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

test('createTemplate: properly hoist and deduplicates multiple stylesheets on a single node', () => {
  expect(
    render(h('div', {
      stylesheet: [sheet1[1].stylesheet, sheet2[1].stylesheet, sheet3[1].stylesheet],
    })),
  ).toMatchSnapshot()
})

test('createTemplate: trims whitespace', () => {
  expect(
    render(h('div', {
      children: '   trims white-space    ',
    })),
  ).toMatchSnapshot()
})
