/* eslint-disable max-len */
import { assert } from '@esm-bundle/chai'
import { wire } from '..'

it('wire()', () => {
  assert.equal(
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
  assert.equal(
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
  assert.equal(
    wire({
      target: 'random',
    }),
    'data-target="random"',
    'with target param only'
  )
  assert.equal(
    wire({
      triggers: {
        click: 'random',
        focus: 'thing',
      },
    }),
    'data-trigger="click->random focus->thing"',
    'with triggers param only'
  )
  assert.equal(
    wire({}),
    '',
    'with empty params'
  )
})
