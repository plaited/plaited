import { assertSnapshot, assertThrows } from '../../dev-deps.ts'
import { css, PlaitedElement, ssr, Template } from '../mod.ts'

// const ssr = (tpl: Template) => {
//   const style = tpl.stylesheets.size
//     ? `<style>${[...tpl.stylesheets].join('')}</style>`
//     : ''
//   return style + tpl.content
// }
Deno.test('createTemplate: self closing - html', (t) => {
  assertSnapshot(
    t,
    ssr(<input type='text'></input>),
  )
})
Deno.test('createTemplate: self closing - svg', (t) =>
  assertSnapshot(t, ssr(<polygon points='0,100 50,25 50,75 100,0'></polygon>)))

Deno.test('createTemplate: falsey - undefined', (t) =>
  assertSnapshot(t, ssr(<div>{undefined}</div>)))
Deno.test('createTemplate: falsey - null', (t) =>
  assertSnapshot(t, ssr(<div>{null}</div>)))
Deno.test('createTemplate: falsey - false', (t) =>
  assertSnapshot(t, ssr(<div>{false}</div>)))

Deno.test('createTemplate: falsey - ""', (t) =>
  assertSnapshot(t, ssr(<div>{''}</div>)))

Deno.test('createTemplate: falsey - 0', (t) =>
  assertSnapshot(t, ssr(<div>{0}</div>)))

Deno.test('createTemplate: falsey - NaN', (t) =>
  assertSnapshot(t, ssr(<div>{NaN}</div>)))

Deno.test('createTemplate: conditional', (t) =>
  assertSnapshot(t, ssr(<div>{true && 'hello'}</div>)))

Deno.test('createTemplate: style attribute', (t) =>
  assertSnapshot(
    t,
    ssr(<div style={{ backgroundColor: 'blue', margin: `12px` }}>styles</div>),
  ))

Deno.test('createTemplate: data-trigger attribute', (t) =>
  assertSnapshot(
    t,
    ssr(
      <div
        data-trigger={{
          click: 'random',
          focus: 'thing',
        }}
      >
        triggers
      </div>,
    ),
  ))

Deno.test('createTemplate: array of PlaitedElements', (t) =>
  assertSnapshot(
    t,
    ssr(
      <div>
        {Array.from(Array(10).keys()).map((n) => <li>{`${n}`}</li>)}
      </div>,
    ),
  ))

Deno.test('createTemplate: should throw with attribute starting with on', () => {
  assertThrows((): void => {
    ssr(
      <div>
        <template shadowrootmode='closed'>
          <img src='nonexistent.png' onerror="alert('xss!')" />
        </template>
      </div>,
    )
  })
})

Deno.test('createTemplate: should throw on script tag', () => {
  assertThrows((): void => {
    ssr(<script type='module' src='main.js'></script>)
  })
})

Deno.test('createTemplate: should not throw on script tag with trusted attribute', (t) => {
  assertSnapshot(t, ssr(<script type='module' src='main.js' trusted></script>))
})

Deno.test('createTemplate: escapes children', (t) => {
  assertSnapshot(
    t,
    ssr(
      <div>
        {`<script type="text/javascript">
const hostRegex = /^https?:\/\/([^\/]+)\/.*$/i;
const host = document.URL.replace(hostRegex, '$1');
const socket = new WebSocket(/);
const reload = () =>{
  location.reload();
  console.log('...reloading');
};
socket.addEventListener('message', reload);
console.log('[plaited] listening for file changes');
</script>`}
      </div>,
    ),
  )
})

Deno.test('createTemplate: doest not escape children when trusted', (t) => {
  assertSnapshot(
    t,
    ssr(
      <div trusted>
        {`<script type="text/javascript">
const hostRegex = /^https?:\/\/([^\/]+)\/.*$/i;
const host = document.URL.replace(hostRegex, '$1');
const socket = new WebSocket(/);
const reload = () =>{
  location.reload();
  console.log('...reloading');
};
socket.addEventListener('message', reload);
console.log('[plaited] listening for file changes');
</script>`}
      </div>,
    ),
  )
})

Deno.test('createTemplate: Fragment of PlaitedElements', (t) =>
  assertSnapshot(
    t,
    ssr(
      <>
        {Array.from(Array(10).keys()).map((n) => <li>{`${n}`}</li>)}
      </>,
    ),
  ))

Deno.test('createTemplate: with slotted PlaitedElements', (t) => {
  const Cel: PlaitedElement = ({ children }) => (
    <c-el slots={children}>
      <slot name='slot'></slot>
    </c-el>
  )
  assertSnapshot(
    t,
    ssr(
      <Cel>
        {Array.from(Array(10).keys()).map((n) => <li slot='slot'>slot-{n}</li>)}
      </Cel>,
    ),
  )
})

Deno.test('createTemplate: Fragment PlaitedElements', (t) =>
  assertSnapshot(
    t,
    ssr(
      <>
        {Array.from(Array(10).keys()).map((n) => <li>item-{n}</li>)}
      </>,
    ),
  ))

const span = css`
.nested-label {
  font-weight: bold;
}
`

const NestedCustomElement: PlaitedElement = ({ children, stylesheet }) => (
  <nested-component slots={children} stylesheet={stylesheet}>
    <span class={span[0]['nested-label']} {...span[1]}>
      inside nested template
    </span>
    <slot name='nested'></slot>
  </nested-component>
)

Deno.test('createTemplate: custom element with child hoisting it\'s styles', (t) =>
  assertSnapshot(
    t,
    ssr(
      <NestedCustomElement />,
    ),
  ))

const nested = css`
  host: {
    display: flex;
    flex-direction: column;
  }
  `
Deno.test('createTemplate: custom element with child and host styles', (t) =>
  assertSnapshot(
    t,
    ssr(
      <NestedCustomElement {...nested[1]} />,
    ),
  ))

const slotted = css`
.slotted-paragraph {
  color: rebeccapurple;
}
`

Deno.test('createTemplate: custom element with styled slotted component', (t) =>
  assertSnapshot(
    t,
    ssr(
      <NestedCustomElement>
        <p
          slot='nested'
          class={slotted[0]['slotted-paragraph']}
          {...slotted[1]}
        >
          slotted paragraph
        </p>
      </NestedCustomElement>,
    ),
  ))
const TopCustomElement: PlaitedElement = ({ children, stylesheet }) => (
  <top-component stylesheet={stylesheet} slots={children}>
    <NestedCustomElement>
      <p
        slot='nested'
        class={slotted[0]['slotted-paragraph']}
        {...slotted[1]}
      >
        slotted paragraph
      </p>
    </NestedCustomElement>
  </top-component>
)
Deno.test('createTemplate: custom element with styles nested in custom element', (t) =>
  assertSnapshot(
    t,
    ssr(
      <TopCustomElement />,
    ),
  ))

const top = css`
:host {
  display: block;
}
`
Deno.test('createTemplate: custom element with styles nested in custom element with styles', (t) =>
  assertSnapshot(
    t,
    ssr(
      <TopCustomElement {...top[1]} />,
    ),
  ))

const testEl = css`
  .image {
    width: 100%;
    aspect-ratio: 16 /9 ;
  }
`

Deno.test('createTemplate: custom element with nested custom element and styled slotted element', (t) =>
  assertSnapshot(
    t,
    ssr(
      <TopCustomElement {...top[1]}>
        <img class={testEl[0].image} {...testEl[1]} />
      </TopCustomElement>,
    ),
  ))
