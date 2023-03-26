import { assertSnapshot } from '../../dev-deps.ts'
import { html, isle } from '../mod.ts'

Deno.test('Island.template()', (t) => {
  const Island = isle({ tag: 'z-el' }, (base) => class extends base {})
  assertSnapshot(
    t,
    Island.template({
      shadow: html`<div>
        <h1>header</h1>
      </div>`,
    }),
    'shadow only',
  )
  assertSnapshot(
    t,
    Island.template({
      id: 'random',
      shadow: html`<div>
        <h1>header</h1>
      </div>`,
    }),
    'shadow and id',
  )
  assertSnapshot(
    t,
    Island.template({
      target: 'random',
      triggers: {
        click: 'random',
        focus: 'thing',
      },
      shadow: html`<div>
        <h1>header</h1>
      </div>`,
    }),
    'data-target, data-trigger, tag, shadow, and id',
  )
  assertSnapshot(
    t,
    Island.template({
      mode: 'closed',
      shadow: html`<div>
        <h1>header</h1>
      </div>`,
    }),
    'shadow, and mode closed',
  )
  assertSnapshot(
    t,
    Island.template({
      slots: '<div>slotted</di>',
      shadow: html`<div>
        <h1>header</h1>
      </div>`,
    }),
    'shadow, and slots',
  )
  assertSnapshot(
    t,
    Island.template({
      styles: '.h1 { color: red}',
      shadow: html`<div>
        <h1>header</h1>
      </div>`,
    }),
    'styles string',
  )
  assertSnapshot(
    t,
    Island.template({
      styles: new Set(['.h1 { color: red}', 'div {opacity: 0.85;}']),
      shadow: html`<div>
        <h1>header</h1>
      </div>`,
    }),
    'styles as set ',
  )
})
