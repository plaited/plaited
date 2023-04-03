import { assertSnapshot } from '../../dev-deps.ts'
import { isle, PlaitedElement, Template } from '../mod.ts'

const ssr = (tpl: Template) => tpl.content

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
  const IslandTemplate: PlaitedElement = ({ children }) => (
    <Island.template slots={children}>
      <div>
        <h1>header</h1>
        <slot name='slot'></slot>
      </div>
    </Island.template>
  )
  assertSnapshot(
    t,
    ssr(
      <IslandTemplate>
        <div slot='slot'>slotted</div>
      </IslandTemplate>,
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
