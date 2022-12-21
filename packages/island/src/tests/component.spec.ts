/* eslint-disable max-len */
import { assert } from '@esm-bundle/chai'
import { component, html } from '..'



// Expected usage const MyTemplate = ({ ..args}) => component({tag, template: html`` ...rest})
it('component()', () => {
  assert.equal(
    component({
      tag: 'z-el',
      template: html`<div>
        <h1>header</h1>
      </div>`,
    }),
    '<z-el><template shadowroot="open"><div><h1>header</h1></div></template></z-el>',
    'tag and template only'
  )
  assert.equal(
    component({
      tag: 'z-el',
      id: 'random',
      template: html`<div>
        <h1>header</h1>
      </div>`,
    }),
    '<z-el id="random"><template shadowroot="open"><div><h1>header</h1></div></template></z-el>',
    'tag, template, and id'
  )
  assert.equal(
    component({
      tag: 'z-el',
      target: 'random',
      triggers: {
        click: 'random',
        focus: 'thing',
      },
      template: html`<div>
        <h1>header</h1>
      </div>`,
    }),
    '<z-el data-target="random" data-trigger="click->random focus->thing"><template shadowroot="open"><div><h1>header</h1></div></template></z-el>',
    'data-target, data-trigger, tag, template, and id'
  )
  assert.equal(
    component({
      tag: 'z-el',
      mode: 'closed',
      template: html`<div>
        <h1>header</h1>
      </div>`,
    }),
    '<z-el><template shadowroot="closed"><div><h1>header</h1></div></template></z-el>',
    'tag, template, and mode'
  )
  assert.equal(
    component({
      tag: 'z-el',
      mode: 'closed',
      template: html`<div>
        <slot></slot>
      </div>`,
      slotted: '<h1>header</h1>',
    }),
    '<z-el><template shadowroot="closed"><div><slot></slot></div></template><h1>header</h1></z-el>',
    'tag, template, slot, and mode'
  )
})
