import { test, expect } from 'bun:test'
import { css } from '../../src/index.js'

test('css(): for global', () => {
  expect(css`
    @keyframes slidein {
      from {
        margin-left: 100%;
        width: 300%;
      }

      to {
        margin-left: 0%;
        width: 100%;
      }
    }
    .button {
      background-color: rgba(255, 0, 0, 0.2);
    }
    .button4:disabled {
      background-color: rgba(255, 0, 0, 0.8);
    }
    ._button-4:disabled > .combinator {
      background-color: va(--background-color);
    }
    ._button-4:disabled + :not(.link) {
      background-color: var(--background-color-disabled);
    }
  `).toMatchSnapshot()
  expect(css`
    .button {
      background-color: rgba(255, 0, 0, 0.2);
    }
    .button4:disabled {
      background-color: rgba(255, 0, 0, 0.8);
    }
    ._button-4:disabled > .combinator {
      background-color: va(--background-color);
    }
    ._button-4:disabled + :not(.link) {
      background-color: var(--background-color-disabled);
    }
  `).toMatchSnapshot()

  expect(css`
    .top {
      color: red;
      & .nested {
        color: blue;
        &.nested2 {
          color: green;
        }
      }
    }
  `).toMatchSnapshot()
})
