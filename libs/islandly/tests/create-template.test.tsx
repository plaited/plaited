import { assertSnapshot, assertThrows } from '../../dev-deps.ts'
import { ssr } from '../mod.ts'

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

Deno.test('createTemplate: Fragment of slotted PlaitedElements', (t) =>
  assertSnapshot(
    t,
    ssr(
      <c-el>
        <slot name='slot'></slot>
        <>
          {Array.from(Array(10).keys()).map((n) => (
            <li slot='slot'>{`${n}`}</li>
          ))}
        </>
      </c-el>,
    ),
  ))
