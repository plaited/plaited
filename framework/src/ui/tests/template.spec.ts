/* eslint-disable no-constant-binary-expression */
import { expect, test } from 'bun:test'
import beautify from 'beautify'
import type { TemplateObject } from 'onbraid/ui'
import { fragment, h } from 'onbraid/ui'

const render = (tpl: TemplateObject) => beautify(tpl.html.join(''), { format: 'html' })

test('h: Self closing - html', () => {
  expect(render(h('input', { type: 'text' }))).toMatchSnapshot()
})

test('h: Self closing - svg', () => {
  expect(render(h('polygon', { points: '0,100 50,25 50,75 100,0' }))).toMatchSnapshot()
})

test('h: Falsey - undefined', () => {
  expect(render(h('div', { children: undefined }))).toMatchSnapshot()
})

test('h: Falsey - null', () => {
  //@ts-expect-error: children is null
  expect(render(h('div', { children: null }))).toMatchSnapshot()
})

test('h: Falsey - false', () => {
  // @ts-expect-error: test
  expect(render(h('div', { children: false }))).toMatchSnapshot()
})

test('h: Not really Falsey - ""', () => {
  expect(render(h('div', { children: '' }))).toMatchSnapshot()
})

test('h: Not really Falsey - 0', () => {
  expect(render(h('div', { children: 0 }))).toMatchSnapshot()
})

test('h: Not really Falsey - NaN', () => {
  expect(render(h('div', { children: NaN }))).toMatchSnapshot()
})

test('h: Bad template - NaN', () => {
  // @ts-expect-error: test
  expect(render(h('div', { children: { string: 'string' } }))).toMatchSnapshot()
})

test('h: Conditional', () => {
  expect(render(h('div', { children: true && 'hello' }))).toMatchSnapshot()
})

test('h: Style attribute', () => {
  expect(
    render(
      h('div', {
        style: { backgroundColor: 'blue', margin: '12px', '--cssVar': 'red' },
        children: 'styles',
      }),
    ),
  ).toMatchSnapshot()
})

test('h: o-trigger attribute', () =>
  expect(
    render(
      h('div', {
        'o-trigger': {
          click: 'random',
          focus: 'thing',
        },
        children: 'triggers',
      }),
    ),
  ).toMatchSnapshot())

test('h: Array of templates', () =>
  expect(
    render(
      h('ul', {
        children: Array.from(Array(10).keys()).map((n) => h('li', { children: `${n}` })),
      }),
    ),
  ).toMatchSnapshot())

test('h: Should throw with attribute starting with on', () => {
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

test('h: rejects mixed-case event handler attributes', () => {
  expect(() => {
    h('img', {
      src: '/avatar.png',
      OnError: "alert('xss!')",
    })
  }).toThrow()
})

test('h: serializes HTML attribute keys as lowercase', () => {
  const output = render(
    h('div', {
      'DATA-State': 'open',
      TABINDEX: 0,
      children: 'Lowercase attrs',
    }),
  )

  expect(output).toContain('data-state="open"')
  expect(output).toContain('tabindex="0"')
  expect(output).not.toContain('DATA-State')
  expect(output).not.toContain('TABINDEX')
})

test('h: treats mixed-case style as an HTML attribute', () => {
  const output = render(
    h('div', {
      STYLE: 'color:red',
      children: 'Style attr',
    }),
  )

  expect(output).toContain('style="color:red"')
  expect(output).not.toContain('0:c;')
})

test('h: rejects script tags without site-root JavaScript src', () => {
  expect(() => {
    h('script', { type: 'module', src: 'main.js' })
  }).toThrow()
  expect(() => {
    h('script', { type: 'module', src: '//example.com/main.js' })
  }).toThrow()
  expect(() => {
    h('script', { type: 'module', src: '/dist/main.ts' })
  }).toThrow()
})

test('h: renders external bootstrap script tags', () => {
  expect(render(h('script', { type: 'module', src: '/dist/main.js?v=1#entry' }))).toMatchSnapshot()
})

test('h: rejects invalid custom element tags', () => {
  expect(() => h('font-face', { children: 'sample' })).toThrow()
  expect(() => h('sample-&element', { children: 'sample' })).toThrow()
})

test('h: rejects inline script content', () => {
  expect(() => {
    h('script', { type: 'module', src: '/dist/main.js', children: 'console.log("nope")' })
  }).toThrow()
})

test('h: Escapes children', () => {
  const scriptContent = `<script type="text/javascript">
const hostRegex = /^https?://([^/]+)/.*$/i;
const host = document.URL.replace(hostRegex, '$1');
const socket = new WebSocket(/);
const reload = () =>{
  location.reload();
  console.log('...reloading');
};
socket.addEventListener('message', reload);
console.log('[onbraid] listening for file changes');
</script>`
  expect(render(h('div', { children: scriptContent }))).toMatchSnapshot()
})

test('fragment', () => {
  expect(
    render(
      fragment(
        Array.from(Array(6).keys())
          .reverse()
          .map((n) => h('li', { children: n > 0 ? `In ${n}` : 'Blast Off!!!' })),
      ),
    ),
  ).toMatchSnapshot()
})

test('h: Trims whitespace', () => {
  expect(
    render(
      h('div', {
        children: '   trims white-space    ',
      }),
    ),
  ).toMatchSnapshot()
})
