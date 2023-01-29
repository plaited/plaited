import test from 'ava'
import { css } from '../../dist/index.js'

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
    button: {
      color: 'var(--color)',
      '&:focus': {
        color: 'var(--color-focus)',
      },
    },
  }))
})
