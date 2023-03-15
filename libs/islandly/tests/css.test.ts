import { assertSnapshot } from '../../test-deps.ts'
import { css } from '../mod.ts'

Deno.test('css()', async (t) => {
  await assertSnapshot(
    t,
    css`
    .button {
      background-color: rgba(255, 0, 0, 0.2);
    }
    .button4:disabled {
      background-color: rgba(255, 0, 0, 0.8);
    }
    ._button-4:disabled {
      background-color: rgba(00, 50, 25, 0.8);
    }
    ._button-4:disabled + :not(.link){
      background-color: rgba(00, 50, 25, 0.8);
    }
    `,
  )
  await assertSnapshot(
    t,
    css`
    .button {
      background-color: rgba(255, 0, 0, 0.2);
    }
    .button4:disabled {
      background-color: rgba(255, 0, 0, 0.8);
    }
    ._button-4:disabled  > .combinator {
      background-color: va(--background-color);
    }
    ._button-4:disabled + :not(.link){
      background-color: var(--background-color-disabled);
    }
    `,
  )
})
