/* eslint-disable no-constant-binary-expression */
import { test, expect } from 'bun:test'
import { type FunctionTemplate, type TemplateObject, ssr } from 'plaited'
import { h, Fragment } from 'plaited/jsx-runtime'
import { css } from 'plaited/styling'
import beautify from 'beautify'

const render = (template: TemplateObject) => {
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
  //@ts-expect-error: children is null
  expect(render(h('div', { children: null }))).toMatchSnapshot()
})

test('ssr: Falsey - false', () => {
  // @ts-expect-error: testing false
  expect(render(h('div', { children: false }))).toMatchSnapshot()
})

test('ssr: Not really Falsey - ""', () => {
  expect(render(h('div', { children: '' }))).toMatchSnapshot()
})

test('ssr: Not really Falsey - 0', () => {
  // @ts-expect-error: testing 0
  expect(render(h('div', { children: 0 }))).toMatchSnapshot()
})

test('ssr: Not really Falsey - NaN', () => {
  // @ts-expect-error: testing NaN
  expect(render(h('div', { children: NaN }))).toMatchSnapshot()
})

test('ssr: Bad template - NaN', () => {
  // @ts-expect-error: testing bad object
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

test('ssr: p-trigger attribute', () =>
  expect(
    render(
      h('div', {
        'p-trigger': {
          click: 'random',
          focus: 'thing',
        },
        children: 'triggers',
      }),
    ),
  ).toMatchSnapshot())

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

const Template: FunctionTemplate = (attrs) => h('template', attrs)

test('ssr: Non declarative shadow DOM template', () => {
  const List: FunctionTemplate = ({ children }) =>
    h('ul', {
      children: [
        Template({ children: h('span', { children: 'I am a span!!!' }) }),
        //@ts-expect-error: children is not undefined
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

test('Fragment', () => {
  expect(
    render(
      Fragment({
        children: Array.from(Array(6).keys())
          .reverse()
          .map((n) => h('li', { children: n > 0 ? `In ${n}` : 'Blast Off!!!' })),
      }),
    ),
  ).toMatchSnapshot()
})

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

const NestedCustomElement: FunctionTemplate = ({ children, ...props }) =>
  h('nested-component', {
    ...props,
    children: [
      Template({
        shadowrootmode: 'open',
        shadowrootdelegatesfocus: true,
        children: [
          h('span', {
            ...styles.nestedLabel,
            children: 'inside nested template',
          }),
          h('slot', { name: 'nested' }),
        ],
      }),
      //@ts-expect-error: children is not undefined
      ...(Array.isArray(children) ? children : [children]),
    ],
  })

test('createTemplate: CustomElement hoisting its styles', () => {
  const el = h(NestedCustomElement, {})
  expect({ content: render(el), stylesheets: el.stylesheets }).toMatchSnapshot()
})

test('createTemplate: CustomElement with declarative shadow dom & host styles', () => {
  const el = h(NestedCustomElement, { ...styles.nestedComponent })
  expect({ content: render(el), stylesheets: el.stylesheets }).toMatchSnapshot()
})

test('createTemplate: CustomElement with styled slotted component', () => {
  const el = h(NestedCustomElement, {
    ...styles.nestedComponent,
    children: [
      h('p', {
        slot: 'nested',
        ...styles.slottedParagraph,
        children: 'slotted paragraph',
      }),
    ],
  })
  expect({ content: render(el), stylesheets: el.stylesheets }).toMatchSnapshot()
})

const TopCustomElement: FunctionTemplate = ({ children, ...props }) =>
  h('top-component', {
    ...props,
    children: [
      Template({
        shadowrootdelegatesfocus: true,
        shadowrootmode: 'open',
        children: h(NestedCustomElement, {
          children: h('p', {
            slot: 'nested',
            ...styles.slottedParagraph,
            children: 'slotted paragraph',
          }),
        }),
      }),
      //@ts-expect-error: children is not undefined
      ...(Array.isArray(children) ? children : [children]),
    ],
  })

test('createTemplate: CustomElement with declarative shadow dom and nested declarative shadow dom', () => {
  const el = h(TopCustomElement, {})
  expect({ content: render(el), stylesheets: el.stylesheets }).toMatchSnapshot()
})

test('createTemplate: CustomElement with declarative shadow dom and nested declarative shadow dom plus host styles', () => {
  const el = h(TopCustomElement, { ...styles.topComponent })
  expect({ content: render(el), stylesheets: el.stylesheets }).toMatchSnapshot()
})

test('createTemplate: CustomElement with declarative shadow dom and nested declarative shadow dom plus host styles and child', () => {
  const el = h(TopCustomElement, {
    ...styles.topComponent,
    children: h('img', { ...styles.image }),
  })
  expect({ content: render(el), stylesheets: el.stylesheets }).toMatchSnapshot()
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
  expect(
    h('div', {
      ...css.assign(hoistStyles.var1, hoistStyles.var2, hoistStyles.var3),
    }).stylesheets.length,
  ).toBe(2)
})

test('ssr: filters out falsey style object', () => {
  expect(
    h('div', {
      ...css.assign(hoistStyles.var1, hoistStyles.var2, false, undefined, null),
    }).stylesheets.length,
  ).toBe(1)
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
