/* eslint-disable no-constant-binary-expression */
import { test, expect } from 'bun:test'
import { type FunctionTemplate, type TemplateObject } from 'plaited'
import { h, Fragment } from 'plaited/jsx-runtime'
import beautify from 'beautify'

const render = (tpl: TemplateObject) => beautify(tpl.html.join(''), { format: 'html' })

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
  //@ts-expect-error: children is null
  expect(render(h('div', { children: null }))).toMatchSnapshot()
})

test('createTemplate: Falsey - false', () => {
  // @ts-expect-error: test
  expect(render(h('div', { children: false }))).toMatchSnapshot()
})

test('createTemplate: Not really Falsey - ""', () => {
  expect(render(h('div', { children: '' }))).toMatchSnapshot()
})

test('createTemplate: Not really Falsey - 0', () => {
  expect(render(h('div', { children: 0 }))).toMatchSnapshot()
})

test('createTemplate: Not really Falsey - NaN', () => {
  expect(render(h('div', { children: NaN }))).toMatchSnapshot()
})

test('createTemplate: Bad template - NaN', () => {
  // @ts-expect-error: test
  expect(render(h('div', { children: { string: 'string' } }))).toMatchSnapshot()
})

test('createTemplate: Conditional', () => {
  expect(render(h('div', { children: true && 'hello' }))).toMatchSnapshot()
})

test('createTemplate: Style attribute', () => {
  expect(
    render(
      h('div', {
        style: { backgroundColor: 'blue', margin: '12px', '--cssVar': 'red' },
        children: 'styles',
      }),
    ),
  ).toMatchSnapshot()
})

test('createTemplate: p-trigger attribute', () =>
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
  expect(render(h('div', { children: scriptContent }))).toMatchSnapshot()
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
  expect(render(h('div', { trusted: true, children: scriptContent }))).toMatchSnapshot()
})

const Template: FunctionTemplate = (attrs) => h('template', attrs)

test('createTemplate: Non declarative shadow DOM template', () => {
  const List: FunctionTemplate = ({ children }) =>
    h('ul', {
      children: [
        Template({ children: h('span', { children: 'I am a span!!!' }) }),
        //@ts-expect-error: test
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

test('createTemplate: Trims whitespace', () => {
  expect(
    render(
      h('div', {
        children: '   trims white-space    ',
      }),
    ),
  ).toMatchSnapshot()
})
