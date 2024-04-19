import { test, expect, beforeAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { FT, TemplateObject, css, assignStyles } from 'plaited'
import { useSSR } from '../render.js'
import beautify from 'beautify'
import { NestedCustomElement } from './__mocks__/deeper/nested-component/nested-component.js'
import { TopCustomElement } from './__mocks__/deeper/top-component.js'
import { styles } from './__mocks__/deeper/constants.js'

let ssr: ReturnType<typeof useSSR>

beforeAll(() => {
  const registry = 'use_ssr'
  const db = new Database(':memory:')
  let query = db.query(`CREATE TABLE ${registry} (tag TEXT PRIMARY KEY, path TEXT NOT NULL)`)
  query.run()
  query = db.query(`INSERT INTO ${registry} (tag, path) VALUES ($tag, $path)`)
  query.run({ $tag: 'top-component', $path: '/top-component.js' })
  query.run({ $tag: 'nested-component', $path: '/nested-component.js' })
  ssr = useSSR(db, registry)
})

const render = (template: TemplateObject) => {
  return beautify(ssr(template), { format: 'html' })
}

test('useSSR: Self closing - html', () => {
  expect(render(<input type='text' />)).toMatchSnapshot()
})

test('useSSR: Self closing - svg', () => {
  expect(render(<polygon points='0,100 50,25 50,75 100,0' />)).toMatchSnapshot()
})

test('useSSR: Falsey - undefined', () => {
  expect(render(<div>{undefined}</div>)).toMatchSnapshot()
})

test('useSSR: Falsey - null', () => {
  expect(render(<div>{null}</div>)).toMatchSnapshot()
})

test('useSSR: Falsey - false', () => {
  expect(render(<div>{false}</div>)).toMatchSnapshot()
})

test('useSSR: Not really Falsey - ""', () => {
  expect(render(<div>{''}</div>)).toMatchSnapshot()
})

test('useSSR: Not really Falsey - 0', () => {
  expect(render(<div>{0}</div>)).toMatchSnapshot()
})

test('useSSR: Not really Falsey - NaN', () => {
  expect(render(<div>{NaN}</div>)).toMatchSnapshot()
})

test('useSSR: Bad template - NaN', () => {
  expect(render(<div>{{ string: 'string' }}</div>)).toMatchSnapshot()
})

test('useSSR: Conditional', () => {
  expect(render(<div>{true && 'hello'}</div>)).toMatchSnapshot()
})

test('useSSR: Style attribute', () =>
  expect(
    render(<div style={{ backgroundColor: 'blue', margin: '12px', '--cssVar': 'red' }}>styles</div>),
  ).toMatchSnapshot())

test('useSSR: bp-trigger attribute', () =>
  expect(
    render(
      <div
        bp-trigger={{
          click: 'random',
          focus: 'thing',
        }}
      >
        triggers
      </div>,
    ),
  ).toMatchSnapshot())

test('useSSR: Array of templates', () =>
  expect(
    render(
      <ul>
        {Array.from(Array(10).keys()).map((n) => (
          <li>{n}</li>
        ))}
      </ul>,
    ),
  ).toMatchSnapshot())

test('useSSR: Should throw with attribute starting with on', () => {
  expect(() => {
    return (
      <img
        src='nonexistent.png'
        onerror="alert('xss!')"
      />
    )
  }).toThrow()
})

test('useSSR: should throw on script tag', () => {
  expect(() => {
    return (
      <script
        type='module'
        src='main.js'
      />
    )
  }).toThrow()
})

test('useSSR: Should not throw on script tag with trusted attribute', () => {
  expect(
    render(
      <script
        type='module'
        src='main.js'
        trusted
      />,
    ),
  ).toMatchSnapshot()
})

test('useSSR: Escapes children', () => {
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

  expect(render(<div>{scriptContent}</div>)).toMatchSnapshot()
})

test('useSSR: Does not escape children when trusted', () => {
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

  expect(render(<div trusted>{scriptContent}</div>)).toMatchSnapshot()
})

const Template: FT = (attrs) => <template {...attrs} />

test('useSSR: Non declarative shadow DOM template', () => {
  const List: FT = ({ children }) => {
    return (
      <ul>
        <Template>
          <span>I am a span!!!</span>
        </Template>
        {children}
      </ul>
    )
  }

  expect(
    render(
      <List>
        {Array.from(Array(10).keys()).map((n) => (
          <li>{`item-${n}`}</li>
        ))}
      </List>,
    ),
  ).toMatchSnapshot()
})

test('Fragment', () => {
  expect(
    render(
      <>
        {Array.from(Array(6).keys())
          .reverse()
          .map((n) => (
            <li>{n > 0 ? `In ${n}` : 'Blast Off!!!'}</li>
          ))}
      </>,
    ),
  ).toMatchSnapshot()
})

test('useSSR: Declarative shadow dom hoisting its styles', () => {
  expect(render(<NestedCustomElement />)).toMatchSnapshot()
})

test('useSSR: Declarative shadow dom with host styles', () => {
  expect(render(<NestedCustomElement stylesheet={nestedHostStyles.$stylesheet} />)).toMatchSnapshot()
})

test('useSSR: Declarative shadow dom with styled slotted component', () => {
  expect(
    render(
      <NestedCustomElement stylesheet={nestedHostStyles.$stylesheet}>
        <p
          slot='nested'
          className={nestedChildrenStyles['slotted-paragraph']}
          stylesheet={nestedChildrenStyles.$stylesheet}
        >
          slotted paragraph
        </p>
      </NestedCustomElement>,
    ),
  ).toMatchSnapshot()
})

test('useSSR: Declarative shadow dom with another declarative shadow dom', () => {
  expect(render(<TopCustomElement />)).toMatchSnapshot()
})


test('useSSR: Declarative shadow dom with another declarative shadow dom plus host styles', () => {
  expect(render(<TopCustomElement stylesheet={hostStyles.$stylesheet} />)).toMatchSnapshot()
})


test('useSSR: Declarative shadow dom with another declarative shadow dom plus host styles and child', () => {
  expect(
    render(
      <TopCustomElement>
        <img
          className={imageStyles.image}
          stylesheet={imageStyles.$stylesheet}
        />
      </TopCustomElement>,
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

test('useSSR: Properly hoist and deduplicates multiple stylesheets on a single node', () => {
  expect(
    render(<div {...assignStyles(sheet1, sheet2, sheet3) }></div>),
  ).toMatchSnapshot()
})

test('useSSR: Trims whitespace', () => {
  expect(render(<div> trims white-space </div>)).toMatchSnapshot()
})
