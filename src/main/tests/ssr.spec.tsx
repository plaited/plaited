/* eslint-disable no-constant-binary-expression */
import { expect, test } from 'bun:test'
import beautify from 'beautify'
import {
  bElement,
  createHostStyles,
  createStyles,
  type FunctionTemplate,
  joinStyles,
  ssr,
  type TemplateObject,
} from 'plaited'
import { Fragment, h } from 'plaited/jsx-runtime'

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
  //@ts-expect-error: testing falsey value
  expect(render(h('div', { children: null }))).toMatchSnapshot()
})

test('ssr: Falsey - false', () => {
  //@ts-expect-error: testing falsey value
  expect(render(h('div', { children: false }))).toMatchSnapshot()
})

test('ssr: Not really Falsey - ""', () => {
  expect(render(h('div', { children: '' }))).toMatchSnapshot()
})

test('ssr: Not really Falsey - 0', () => {
  expect(render(h('div', { children: 0 }))).toMatchSnapshot()
})

test('ssr: Not really Falsey - NaN', () => {
  expect(render(h('div', { children: NaN }))).toMatchSnapshot()
})

test('ssr: Bad template - NaN', () => {
  expect(
    //@ts-expect-error: testing error
    render(h('div', { children: { string: 'string' } })),
  ).toMatchSnapshot()
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
        //@ts-expect-error: testing error
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

// Hoisting and Declarative Shadow DOM Tests

const styles = createStyles({
  nestedLabel: {
    fontWeight: 'bold',
  },
  nestedElement: {
    display: 'flex',
    flexDirection: 'column',
  },
  slottedParagraph: {
    color: 'rebeccapurple',
  },
  topElement: {
    display: 'block',
  },
  image: {
    width: '100%',
    aspectRatio: '16 / 9',
  },
})

const NestedCustomElement = bElement({
  tag: 'nested-element',
  shadowDom: (
    <>
      <span {...styles.nestedLabel}>inside nested template</span>
      <slot name='nested' />
    </>
  ),
})

test('ssr: CustomElement hoisting its styles', () => {
  const el = <NestedCustomElement />
  expect({
    content: render(el),
    stylesheets: el.stylesheets,
  }).toMatchSnapshot()
})

test('ssr: CustomElement with declarative shadow dom & hoist styles', () => {
  const el = <NestedCustomElement {...styles.nestedElement} />
  expect({
    content: render(el),
    stylesheets: el.stylesheets,
  }).toMatchSnapshot()
})

test('ssr: CustomElement with styled slotted element', () => {
  const el = (
    <NestedCustomElement {...styles.slottedParagraph}>
      <p slot='nested'>slotted paragraph</p>
    </NestedCustomElement>
  )
  expect({
    content: render(el),
    stylesheets: el.stylesheets,
  }).toMatchSnapshot()
})

const TopCustomElement = bElement({
  tag: 'top-element',
  shadowDom: (
    <NestedCustomElement {...styles.slottedParagraph}>
      <p slot='nested'>slotted paragraph</p>
    </NestedCustomElement>
  ),
})

test('ssr: CustomElement with declarative shadow dom and nested declarative shadow dom', () => {
  const el = <TopCustomElement />
  expect({
    content: render(el),
    stylesheets: el.stylesheets,
  }).toMatchSnapshot()
})

test('ssr: CustomElement with declarative shadow dom and nested declarative shadow dom plus host styles', () => {
  const el = <TopCustomElement {...styles.topElement} />
  expect({
    content: render(el),
    stylesheets: el.stylesheets,
  }).toMatchSnapshot()
})

test('ssr: CustomElement with declarative shadow dom and nested declarative shadow dom plus host styles and child', () => {
  const el = (
    <TopCustomElement {...styles.topElement}>
      {/* biome-ignore lint/a11y/useAltText: Test fixture doesn't need alt text */}
      <img {...styles.image} />
    </TopCustomElement>
  )
  expect({
    content: render(el),
    stylesheets: el.stylesheets,
  }).toMatchSnapshot()
})

const hoistStyles = createStyles({
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

test('ssr: Properly hoists multiple stylesheets on a single node (deduplication happens at consumption)', () => {
  // Intermediate template has 3 stylesheets (var1, var2, var3 - var1 and var2 have same CSS)
  // Deduplication happens later in ssr() via Set.add() or in updateShadowRootStyles via cssCache
  expect((<div {...joinStyles(hoistStyles.var1, hoistStyles.var2, hoistStyles.var3)} />).stylesheets.length).toBe(3)
})

test('ssr: Replaces :host{ with :root{ for SSR', () => {
  const hostStyles = createHostStyles({
    color: 'blue',
    padding: '20px',
  })

  const rendered = ssr(<div {...hostStyles}>Host styles test</div>)

  // Verify :host{ is replaced with :root{
  expect(rendered).not.toContain(':host{')
  expect(rendered).toContain(':root{')
})

test('ssr: Replaces :host(<selector>) with :root<selector> for SSR', () => {
  const hostStyles = createHostStyles({
    color: {
      $default: 'blue',
      $compoundSelectors: {
        '.dark': 'white',
        '[disabled]': 'gray',
        ':hover': 'lightblue',
      },
    },
  })

  const rendered = ssr(<div {...hostStyles}>Host selector styles test</div>)

  // Verify :host(<selector>) is replaced with :root<selector>
  expect(rendered).not.toContain(':host(')
  expect(rendered).not.toContain(':host.')
  expect(rendered).not.toContain(':host[')
  expect(rendered).not.toContain(':host:')

  // Verify :root variants are present
  expect(rendered).toContain(':root.dark')
  expect(rendered).toContain(':root[disabled]')
  expect(rendered).toContain(':root:hover')
})
