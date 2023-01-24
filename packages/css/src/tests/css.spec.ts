import test from 'ava'
import { css } from '../index.js'

test('css()', t => {
  t.snapshot(
    css({
      button: {
        backgroundColor: 'var(--background-color)',
        '&:disabled': {
          backgroundColor: 'var(--background-color-disabled)',
        },
      },
    })
  )
  t.snapshot(css({
    anchor: {
      color: 'var(--color)',
      '&:focus': {
        color: 'var(--color-focus)',
      },
    },
  }))
})
