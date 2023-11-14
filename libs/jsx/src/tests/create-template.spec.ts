import { test, expect } from 'bun:test'
import { createTemplate as h, css, Fragment, FT, Template } from '../index.js'
import beautify from 'beautify'

const render = (tpl: Template) => {
  const template = document.createElement('template')
  template.content.append(tpl.content)
  return beautify(template.innerHTML, { format: 'html' })
}

test('createTemplate: Self closing - html', () => {
  expect(render(h('input', { type: 'text' }))).toMatchSnapshot()
})

test('createTemplate: Self closing - svg', () => {
  expect(render(h('polygon', { points: '0,100 50,25 50,75 100,0' }))).toMatchSnapshot()
})

test('createTemplate: Falsey - undefined', () => {
  expect(render(h('div', { children: undefined }))).toMatchSnapshot()
})

test('createTemplate: Falsey - null', () => {
  expect(render(h('div', { children: null }))).toMatchSnapshot()
})

test('createTemplate: Falsey - false', () => {
  expect(render(h('div', { children: false }))).toMatchSnapshot()
})

test('createTemplate: Falsey - ""', () => {
  expect(render(h('div', { children: '' }))).toMatchSnapshot()
})

test('createTemplate: Falsey - 0', () => {
  expect(render(h('div', { children: 0 }))).toMatchSnapshot()
})

test('createTemplate: Falsey - NaN', () => {
  expect(render(h('div', { children: NaN }))).toMatchSnapshot()
})

test('createTemplate: Bad template - NaN', () => {
  expect(render(h('div', { children: { string: 'string' } }))).toMatchSnapshot()
})

test('createTemplate: Conditional', () => {
  expect(render(h('div', { children: true && 'hello' }))).toMatchSnapshot()
})

test('createTemplate: Style attribute', () => {
  const { content } = h('div', {
    style: { backgroundColor: 'blue', margin: '12px', '--cssVar': 'red' },
    children: 'styles',
  })
  const style = (content as HTMLDivElement).style.cssText
  expect(style).toMatchSnapshot()
})

test('createTemplate: data-trigger attribute', () =>
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

test('createTemplate: kebab-case attributes', () => {
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

test('createTemplate: Array of templates', () =>
  expect(
    render(
      h('ul', {
        children: Array.from(Array(10).keys()).map((n) => h('li', { children: `${n}` })),
      }),
    ),
  ).toMatchSnapshot())

test('createTemplate: Should throw with attribute starting with on', () => {
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

test('createTemplate: Should not throw on script tag with trusted attribute', () => {
  expect(render(h('script', { type: 'module', src: 'main.js', trusted: true }))).toMatchSnapshot()
})

test('createTemplate: Escapes children', () => {
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
  const { content } = h('div', { children: scriptContent })
  expect(content.firstElementChild).toMatchSnapshot()
})

test('createTemplate: Does not escape children when trusted', () => {
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
  const { content } = h('div', { trusted: true, children: scriptContent })
  expect(content.firstElementChild.outerHTML).toMatchSnapshot()
})

const Template: FT = (attrs) => h('template', attrs)

test('createTemplate: Non declarative shadow DOM template', () => {
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

test('createTemplate: Fragment', () => {
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

test('createTemplate: CustomElement hoisting its styles', () => {
  const el = h(NestedCustomElement, {})
  expect({ content: render(el), stylesheets: el.stylesheets }).toMatchSnapshot()
})

const nestedHostStyles = css`
  host: {
    display: flex;
    flex-direction: column;
  }
`

test('createTemplate: CustomElement with declarative shadow dom & host styles', () => {
  const el = h(NestedCustomElement, { ...nestedHostStyles[1] })
  expect({ content: render(el), stylesheets: el.stylesheets }).toMatchSnapshot()
})

const nestedChildrenStyles = css`
  .slotted-paragraph {
    color: rebeccapurple;
  }
`

test('createTemplate: CustomElement with styled slotted component', () => {
  const el = h(NestedCustomElement, {
    children: [
      h('p', {
        slot: 'nested',
        className: nestedChildrenStyles[0]['slotted-paragraph'],
        ...nestedChildrenStyles[1],
        children: 'slotted paragraph',
      }),
    ],
  })
  expect({ content: render(el), stylesheets: el.stylesheets }).toMatchSnapshot()
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

test('createTemplate: CustomElement with declarative shadow dom and nested declarative shadow dom', () => {
  const el = h(TopCustomElement, {})
  expect({ content: render(el), stylesheets: el.stylesheets }).toMatchSnapshot()
})

const hostStyles = css`
  :host {
    display: block;
  }
`

test('createTemplate: CustomElement with declarative shadow dom and nested declarative shadow dom plus host styles', () => {
  const el = h(TopCustomElement, { ...hostStyles[1] })
  expect({ content: render(el), stylesheets: el.stylesheets }).toMatchSnapshot()
})

const imageStyles = css`
  .image {
    width: 100%;
    aspect-ratio: 16 / 9;
  }
`

test('createTemplate: CustomElement with declarative shadow dom and nested declarative shadow dom plus host styles and child', () => {
  const el = h(TopCustomElement, {
    ...hostStyles[1],
    children: h('img', { className: imageStyles[0].image, ...imageStyles[1] }),
  })
  expect({ content: render(el), stylesheets: el.stylesheets }).toMatchSnapshot()
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
    h('div', {
      stylesheet: [sheet1[1].stylesheet, sheet2[1].stylesheet, sheet3[1].stylesheet],
    }).stylesheets.size,
  ).toBe(2)
})

test('createTemplate: Trims whitespace', () => {
  expect(
    render(
      h('div', {
        children: '   trims white-space    ',
      }),
    ),
  ).toMatchSnapshot()
})
