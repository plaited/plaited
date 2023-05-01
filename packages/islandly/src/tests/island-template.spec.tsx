import { isle, PlaitedElement, ssr } from '../index.js'
import { test } from '@plaited/rite'

const Island = isle({ tag: 'z-el' }, base => class extends base {})


test('Island.template: shadow only', t => {
  t({
    given: 'basic child content',
    should: 'render content into template tag with shadowrootmode=open and shadowrootdelegatesfocus=true',
    actual:ssr(
      <Island.template>
        <div>
          <h1>header</h1>
        </div>
      </Island.template>
    ),
    expected:`<z-el><template shadowrootmode="open" shadowrootdelegatesfocus="true"><div><h1>header</h1></div></template></z-el>`,
  })
})
test('Island.template: shadow and id', t => {
  t({
    given: 'a random idea',
    should: 'should apply id to root tag z-el',
    actual:ssr(
      <Island.template id='random'>
        <div>
          <h1>header</h1>
        </div>
      </Island.template>
    ),
    expected:`<z-el id="random"><template shadowrootmode="open" shadowrootdelegatesfocus="true"><div><h1>header</h1></div></template></z-el>`,
  })
})
test('Island.template: shadow, and mode closed', t => {
  t({
    given: 'setting shadowrootmode=closed',
    should: 'show shadowrootmode=closed in generated string',
    actual:ssr(
      <Island.template shadowrootmode='closed'>
        <div>
          <h1>header</h1>
        </div>
      </Island.template>
    ),
    expected:`<z-el><template shadowrootmode="closed" shadowrootdelegatesfocus="true"><div><h1>header</h1></div></template></z-el>`,
  })
})
test('Island.template: shadow, and slots', t => {
  const IslandTemplate: PlaitedElement = ({ children }) => (
    <Island.template slots={children}>
      <div>
        <h1>header</h1>
        <slot name='slot'></slot>
      </div>
    </Island.template>
  )
  t({
    given: 'passing children to a PlaitedElement that assigns them to slot',
    should: 'render children outside of the template tag',
    actual:ssr(
      <IslandTemplate>
        <div slot='slot'>slotted</div>
      </IslandTemplate>
    ),
    expected:`<z-el><template shadowrootmode="open" shadowrootdelegatesfocus="true"><div><h1>header</h1><slot name="slot"></slot></div></template><div slot="slot">slotted</div></z-el>`,
  })
})
test('Island.template: stylesheet string', t => {
  t({
    given: 'passing stylesheet to custom element tag',
    should: 'render stylesheet inside the template tag of custom element',
    actual:ssr(
      <Island.template stylesheet='.h1 { color: red}'>
        <div>
          <h1>header</h1>
        </div>
      </Island.template>
    ),
    expected:`<z-el><template shadowrootmode="open" shadowrootdelegatesfocus="true"><style>.h1 { color: red}</style><div><h1>header</h1></div></template></z-el>`,
  })
})

