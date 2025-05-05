/**
 * Demonstrates slot handling and event propagation through Plaited components.
 * Shows how to work with default slots, named slots, and nested slot content
 * while managing event bubbling and composition.
 *
 * Features:
 * - Default and named slot usage
 * - Event handling for slotted content
 * - Nested slot composition
 * - Event propagation control
 * - Shadow DOM boundaries
 *
 * @example
 * ```tsx
 * const Card = defineElement({
 *   tag: 'my-card',
 *   shadowDom: (
 *     <div>
 *       <slot name="header"
 *         p-trigger={{ click: 'handleHeader' }}
 *       />
 *       <slot /> //Default slot content
 *       <slot name="footer" />
 *     </div>
 *   ),
 *   bProgram() {
 *     return {
 *       handleHeader(e: Event) {
 *         e.stopPropagation();
 *         console.log('Header clicked');
 *       }
 *     };
 *   }
 * });
 *
 * // Usage with different slot types
 * const App = () => (
 *   <Card>
 *     <h2 slot="header">Title</h2>
 *     <p>Default slot content</p>
 *     <div slot="footer">Footer content</div>
 *   </Card>
 * );
 * ```
 */

import { type FT, defineElement } from 'plaited'
import sinon from 'sinon'

export const defaultSlot = sinon.spy()
export const passThroughSlot = sinon.spy()
export const namedSlot = sinon.spy()
export const nestedSlot = sinon.spy()
export const nestedInShadowSlot = sinon.spy()

const Inner = defineElement({
  tag: 'inner-slot',
  shadowDom: (
    <>
      <slot p-trigger={{ click: 'nested' }}></slot>
      <slot
        p-trigger={{ click: 'nestedInShadow' }}
        name='shadow'
      ></slot>
    </>
  ),
  bProgram() {
    return {
      nested(e: Event) {
        e.stopPropagation()
        nestedSlot()
      },
      nestedInShadow(e: Event) {
        e.stopPropagation()
        nestedInShadowSlot()
      },
    }
  },
})

const Outer = defineElement({
  tag: 'outer-slot',
  shadowDom: (
    <div>
      <slot p-trigger={{ click: 'slot' }}></slot>
      <slot
        name='named'
        p-trigger={{ click: 'named' }}
      ></slot>
      <Inner p-trigger={{ click: 'passThrough' }}>
        <slot name='nested'></slot>
        <button slot='shadow'>Shadow</button>
      </Inner>
    </div>
  ),
  bProgram: () => ({
    slot() {
      defaultSlot()
    },
    named() {
      namedSlot()
    },
    passThrough() {
      passThroughSlot()
    },
  }),
})

export const Fixture: FT = () => (
  <Outer>
    <button>Slot</button>
    <button slot='named'>Named</button>
    <button slot='nested'>Nested</button>
  </Outer>
)
