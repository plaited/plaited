import { assertSnapshot } from '../../dev-deps.js'
import { isle, PlaitedElement, ssr } from '../mod.js'

const Island = isle({ tag: 'z-el' }, base => class extends base {})
Deno.test('Island.template: shadow only', t => {
  assertSnapshot(
    t,
    ssr(
      <Island.template>
        <div>
          <h1>header</h1>
        </div>
      </Island.template>
    )
  )
})
Deno.test('Island.template: shadow and id', t => {
  assertSnapshot(
    t,
    ssr(
      <Island.template>
        <div id='random'>
          <h1>header</h1>
        </div>
      </Island.template>
    )
  )
})
Deno.test('Island.template: shadow, and mode closed', t => {
  assertSnapshot(
    t,
    ssr(
      <Island.template shadowrootmode='closed'>
        <div>
          <h1>header</h1>
        </div>
      </Island.template>
    )
  )
})
Deno.test('Island.template: shadow, and slots', t => {
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
      </IslandTemplate>
    )
  )
})
Deno.test('Island.template: styles string', t => {
  assertSnapshot(
    t,
    ssr(
      <Island.template styles='.h1 { color: red}'>
        <div>
          <h1>header</h1>
        </div>
      </Island.template>
    )
  )
})
