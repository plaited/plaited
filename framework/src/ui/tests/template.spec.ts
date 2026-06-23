/* eslint-disable no-constant-binary-expression */
import { expect, test } from 'bun:test'
import beautify from 'beautify'
import type { TemplateObject } from 'plaited/ui'
import { $case, $default, $for, $slot, $switch, $val, $with, getFlowControlIdMarker, getFlowControlPrefixMarker, getFlowControlSuffixMarket, fragment, h } from 'plaited/ui'

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

test('h: p-trigger attribute', () =>
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
console.log('[plaited] listening for file changes');
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

test('getFlowControlPrefixMarker: produces opening marker', () => {
  expect(getFlowControlPrefixMarker('for')).toBe('<!--? for')
  expect(getFlowControlPrefixMarker('switch')).toBe('<!--? switch')
  expect(getFlowControlPrefixMarker('case')).toBe('<!--? case')
})

test('getFlowControlSuffixMarket: produces closing marker', () => {
  expect(getFlowControlSuffixMarket('for')).toBe('<!--? end-for -->')
  expect(getFlowControlSuffixMarket('switch')).toBe('<!--? end-switch -->')
  expect(getFlowControlSuffixMarket('case')).toBe('<!--? end-case -->')
})

test('getFlowControlSuffixMarket: does not accept val', () => {
  // @ts-expect-error: val has no suffix
  getFlowControlSuffixMarket('val')
})

test('getFlowControlIdMarker: formats id', () => {
  expect(getFlowControlIdMarker('abc123')).toBe('abc123 -->')
  expect(getFlowControlIdMarker(42)).toBe('42 -->')
})

test('$val: produces val marker string', () => {
  const result = $val(42)
  expect(result).toBe('<!--? val 42 -->')
})

test('$for: wraps template in flow control comments', () => {
  const inner = h('p', { children: 'hello' })
  const result = $for('items-1', inner)

  // Should be a TemplateObject with comment markers around inner content
  expect(result.$).toBe('🦄')
  expect(result.html[0]).toBe('<!--? for')
  expect(result.html[1]).toBe('items-1 -->')
  // Inner template content preserved (h() generates fragments like "<p ", ">")
  const joined = result.html.join('')
  expect(joined).toMatch(/<!--\? foritems-1 -->/)
  expect(joined).toMatch(/hello/)
  expect(joined).toMatch(/<!--\? end-for -->/)
  expect(result.html[result.html.length - 1]).toBe('<!--? end-for -->')
})

test('$switch: wraps template in switch comments', () => {
  const inner = h('div', { children: 'case-content' })
  const result = $switch('sw-1', inner)

  expect(result.html[0]).toBe('<!--? switch')
  expect(result.html[1]).toBe('sw-1 -->')
  expect(result.html[result.html.length - 1]).toBe('<!--? end-switch -->')
  expect(result.$).toBe('🦄')
})

test('$case: wraps template in case comments', () => {
  const inner = h('span', { children: 'matched' })
  const result = $case('case-a', inner)

  expect(result.html[0]).toBe('<!--? case')
  expect(result.html[result.html.length - 1]).toBe('<!--? end-case -->')
})

test('$default: wraps template in default comments', () => {
  const inner = h('p', { children: 'fallback' })
  const result = $default('def-1', inner)

  expect(result.html[0]).toBe('<!--? default')
  expect(result.html[result.html.length - 1]).toBe('<!--? end-default -->')
})

test('$with: wraps template in with comments', () => {
  const inner = h('p', { children: 'context' })
  const result = $with('ctx-1', inner)

  expect(result.html[0]).toBe('<!--? with')
  expect(result.html[result.html.length - 1]).toBe('<!--? end-with -->')
})

test('$slot: wraps template in slot comments', () => {
  const inner = h('p', { children: 'slot-content' })
  const result = $slot('slot-1', inner)

  expect(result.html[0]).toBe('<!--? slot')
  expect(result.html[result.html.length - 1]).toBe('<!--? end-slot -->')
})

test('flow control markers survive h() escaping when used as children', () => {
  const inner = h('p', { children: 'hello' })
  const result = h('div', {
    children: $for('items-1', inner),
  })
  const html = result.html.join('')

  // Comment markers should NOT be HTML-escaped
  expect(html).toContain('<!--? for')
  expect(html).toContain('items-1 -->')
  expect(html).toContain('<!--? end-for -->')
  // Inner template content preserved
  expect(html).toMatch(/hello/)
  // Should NOT have escaped versions
  expect(html).not.toContain('&lt;!--')
})

test('flow control wrappers pass through stylesheets from inner template', () => {
  const inner = h('p', {
    children: 'styled',
    stylesheets: ['body { color: red; }'],
  })
  const result = $for('items-1', inner)

  expect(result.stylesheets).toContain('body { color: red; }')
})
