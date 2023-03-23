import { assertSnapshot } from '../../dev-deps.ts'
import { html, IslandTemplate } from '../mod.ts'

// Expected usage const MyTemplate = ({ ..args}) => IslandTemplate({tag, template: html`` ...rest})
Deno.test('IslandTemplate()', (t) => {
  assertSnapshot(
    t,
    IslandTemplate({
      tag: 'z-el',
      template: html`<div>
        <h1>header</h1>
      </div>`,
    }),
    'tag and template only',
  )
  assertSnapshot(
    t,
    IslandTemplate({
      tag: 'z-el',
      id: 'random',
      template: html`<div>
        <h1>header</h1>
      </div>`,
    }),
    'tag, template, and id',
  )
  assertSnapshot(
    t,
    IslandTemplate({
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
    'data-target, data-trigger, tag, template, and id',
  )
  assertSnapshot(
    t,
    IslandTemplate({
      tag: 'z-el',
      mode: 'closed',
      template: html`<div>
        <h1>header</h1>
      </div>`,
    }),
    'tag, template, and mode closed',
  )
  assertSnapshot(
    t,
    IslandTemplate({
      tag: 'z-el',
      slots: '<div>slotted</di>',
      template: html`<div>
        <h1>header</h1>
      </div>`,
    }),
    'tag, template, and slots',
  )
  assertSnapshot(
    t,
    IslandTemplate({
      tag: 'z-el',
      styles: '.h1 { color: red}',
      template: html`<div>
        <h1>header</h1>
      </div>`,
    }),
    'tag and styles string',
  )
  assertSnapshot(
    t,
    IslandTemplate({
      tag: 'z-el',
      styles: new Set(['.h1 { color: red}', 'div {opacity: 0.85;}']),
      template: html`<div>
        <h1>header</h1>
      </div>`,
    }),
    'tag and styles as set ',
  )
})
