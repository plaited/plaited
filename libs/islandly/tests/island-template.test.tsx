import { assertSnapshot } from '../../dev-deps.ts'
import { isle, ssr } from '../mod.ts'

const Island = isle({ tag: 'z-el' }, (base) => class extends base {})
Deno.test('Island.template: shadow only', (t) => {
  assertSnapshot(
    t,
    ssr(
      <Island.template>
        <div>
          <h1>header</h1>
        </div>
      </Island.template>,
    ),
  )
})
Deno.test('Island.template: shadow and id', (t) => {
  assertSnapshot(
    t,
    ssr(
      <Island.template>
        <div id='random'>
          <h1>header</h1>
        </div>
      </Island.template>,
    ),
  )
})
Deno.test('Island.template: data-target, data-trigger, tag, shadow, and id', (t) => {
  assertSnapshot(
    t,
    ssr(
      <Island.template>
        <div
          target='random'
          dataTrigger={{
            click: 'random',
            focus: 'thing',
          }}
        >
          <h1>header</h1>
        </div>
      </Island.template>,
    ),
  )
})
Deno.test('Island.template: shadow, and mode closed', (t) => {
  assertSnapshot(
    t,
    ssr(
      <Island.template shadowRootMode='closed'>
        <div>
          <h1>header</h1>
        </div>
      </Island.template>,
    ),
  )
})
Deno.test('Island.template: shadow, and slots', (t) => {
  assertSnapshot(
    t,
    ssr(
      <Island.template>
        <div>
          <h1>header</h1>
          <slot name='slot'></slot>
        </div>
        <div slot='slot'>slotted</div>
      </Island.template>,
    ),
  )
})
Deno.test('Island.template: styles string', (t) => {
  assertSnapshot(
    t,
    ssr(
      <Island.template styles='.h1 { color: red}'>
        <div>
          <h1>header</h1>
        </div>
      </Island.template>,
    ),
  )
})
Deno.test('Island.template: styles as set ', (t) => {
  assertSnapshot(
    t,
    ssr(
      <Island.template
        styles={new Set(['.h1 { color: red}', 'div {opacity: 0.85;}'])}
      >
        <div>
          <h1>header</h1>
        </div>
      </Island.template>,
    ),
  )
})
