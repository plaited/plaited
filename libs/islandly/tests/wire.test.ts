import { assertEquals } from '../../dev-deps.ts'
import { wire } from '../mod.ts'

Deno.test('wire()', () => {
  assertEquals(
    wire({
      target: 'random',
      triggers: {
        click: 'random',
        focus: 'thing',
      },
      random: false,
      disabled: true,
      value: 'special',
      'aria-grabbed': true,
      'aria-expanded': false,
    }),
    'data-target="random" data-trigger="click->random focus->thing" disabled value="special" aria-grabbed="true" aria-expanded="false"',
  )
  assertEquals(
    wire({
      target: 'random',
      triggers: {
        click: 'random',
        focus: 'thing',
      },
    }),
    'data-target="random" data-trigger="click->random focus->thing"',
    'both params',
  )
  assertEquals(
    wire({
      target: 'random',
    }),
    'data-target="random"',
    'with target param only',
  )
  assertEquals(
    wire({
      triggers: {
        click: 'random',
        focus: 'thing',
      },
    }),
    'data-trigger="click->random focus->thing"',
    'with triggers param only',
  )
  assertEquals(
    wire({}),
    '',
    'with empty params',
  )
})
