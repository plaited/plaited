/* eslint-disable max-len */
import test from 'ava'
import { wire } from '../mod.ts'

test('wire()', t => {
  t.is(
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
    'data-target="random" data-trigger="click->random focus->thing" disabled value="special" aria-grabbed="true" aria-expanded="false"'
  )
  t.is(
    wire({
      target: 'random',
      triggers: {
        click: 'random',
        focus: 'thing',
      },
    }),
    'data-target="random" data-trigger="click->random focus->thing"',
    'both params'
  )
  t.is(
    wire({
      target: 'random',
    }),
    'data-target="random"',
    'with target param only'
  )
  t.is(
    wire({
      triggers: {
        click: 'random',
        focus: 'thing',
      },
    }),
    'data-trigger="click->random focus->thing"',
    'with triggers param only'
  )
  t.is(
    wire({}),
    '',
    'with empty params'
  )
})
