/* eslint-disable max-len */
import { assert } from '@esm-bundle/chai'
import { island, html } from '..'


it('island()', () => {
  assert.equal(
    island({
      tag: 'z-el',
      template: html`<div>
        <h1>header</h1>
      </div>`,
    }),
    '<z-el><template shadowroot="open"><div><h1>header</h1></div></template></z-el>',
    'tag and template only'
  )
  // assert.equal(
  //   island({
  //     tag: 'z-el',
  //     id: 'random',
  //     template: html`<div>
  //       <h1>header</h1>
  //     </div>`,
  //   }),
  //   '<z-el id="random"><template shadowroot="open"><div><h1>header</h1></div></template></z-el>',
  //   'tag, template, and id'
  // )
  // assert.equal(
  //   island({
  //     tag: 'z-el',
  //     target: 'random',
  //     triggers: {
  //       click: 'random',
  //       focus: 'thing',
  //     },
  //     template: html`<div>
  //       <h1>header</h1>
  //     </div>`,
  //   }),
  //   '<z-el data-target="random" data-trigger="click->random focus->thing"><template shadowroot="open"><div><h1>header</h1></div></template></z-el>',
  //   'data-target, data-trigger, tag, template, and id'
  // )
  // assert.equal(
  //   island({
  //     tag: 'z-el',
  //     mode: 'closed',
  //     template: html`<div>
  //       <h1>header</h1>
  //     </div>`,
  //   }),
  //   '<z-el><template shadowroot="closed"><div><h1>header</h1></div></template></z-el>',
  //   'tag, template, and mode'
  // )
})
