import { assertSnapshot } from '../../test-deps.ts'
import { css } from '../mod.ts'

Deno.test('css()', async (t) => {
  await assertSnapshot(
    t,
    css({
      button: {
        backgroundColor: 'var(--background-color)',
        '&:disabled': {
          backgroundColor: 'var(--background-color-disabled)',
        },
      },
    }),
  )
  await assertSnapshot(
    t,
    css({
      button: {
        color: 'var(--color)',
        '&:focus': {
          color: 'var(--color-focus)',
        },
      },
    }),
  )
})
