import { assertSnapshot } from '../../dev-deps.ts'
import { isle, ssr } from '../mod.ts'

Deno.test('Island.template()', (t) => {
  const Island = isle({ tag: 'z-el' }, (base) => class extends base {})
  assertSnapshot(
    t,
    ssr(
      <Island.template>
        <div>
          <h1>header</h1>
        </div>
      </Island.template>,
    ),
    'shadow only',
  )
  assertSnapshot(
    t,
    ssr(
      <Island.template>
        <div id='random'>
          <h1>header</h1>
        </div>
      </Island.template>,
    ),
    'shadow and id',
  )
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
    'data-target, data-trigger, tag, shadow, and id',
  )
  assertSnapshot(
    t,
    ssr(
      <Island.template>
        <div shadowRootMode='closed'>
          <h1>header</h1>
        </div>
      </Island.template>,
    ),
    'shadow, and mode closed',
  )
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
    'shadow, and slots',
  )
  assertSnapshot(
    t,
    ssr(
      <Island.template styles='.h1 { color: red}'>
        <div>
          <h1>header</h1>
        </div>
      </Island.template>,
    ),
    'styles string',
  )
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
    'styles as set ',
  )
})
