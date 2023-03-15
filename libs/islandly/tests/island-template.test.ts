import { assertSnapshot } from '../../test-deps.ts'
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
})
