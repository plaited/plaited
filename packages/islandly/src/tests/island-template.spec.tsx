import { isle, PlaitedElement, ssr } from '../index.js'
import { assert } from '@esm-bundle/chai'
const Island = isle({ tag: 'z-el' }, base => class extends base {})

describe('isle', () => {
  it('Island.template: shadow only', () => {
    assert.equal(
      ssr(
        <Island.template>
          <div>
            <h1>header</h1>
          </div>
        </Island.template>
      ),
      `<z-el><template shadowrootmode="open" shadowrootdelegatesfocus="true"><div><h1>header</h1></div></template></z-el>`
    )
  })
  it('Island.template: shadow and id', () => {
    assert.equal(
      ssr(
        <Island.template id='random'>
          <div>
            <h1>header</h1>
          </div>
        </Island.template>
      ),
      `<z-el id="random"><template shadowrootmode="open" shadowrootdelegatesfocus="true"><div><h1>header</h1></div></template></z-el>`
    )
  })
  it('Island.template: shadow, and mode closed', () => {
    assert.equal(
      ssr(
        <Island.template shadowrootmode='closed'>
          <div>
            <h1>header</h1>
          </div>
        </Island.template>
      ),
      `<z-el><template shadowrootmode="closed" shadowrootdelegatesfocus="true"><div><h1>header</h1></div></template></z-el>`
    )
  })
  it('Island.template: shadow, and slots', () => {
    const IslandTemplate: PlaitedElement = ({ children }) => (
      <Island.template slots={children}>
        <div>
          <h1>header</h1>
          <slot name='slot'></slot>
        </div>
      </Island.template>
    )
    assert.equal(
      ssr(
        <IslandTemplate>
          <div slot='slot'>slotted</div>
        </IslandTemplate>
      ),
      `<z-el><template shadowrootmode="open" shadowrootdelegatesfocus="true"><div><h1>header</h1><slot name="slot"></slot></div></template><div slot="slot">slotted</div></z-el>`
    )
  })
  it('Island.template: styles string', () => {
    assert.equal(
      ssr(
        <Island.template styles='.h1 { color: red}'>
          <div>
            <h1>header</h1>
          </div>
        </Island.template>
      ),
      `<z-el styles=".h1 { color: red}"><template shadowrootmode="open" shadowrootdelegatesfocus="true"><div><h1>header</h1></div></template></z-el>`
    )
  })
})
