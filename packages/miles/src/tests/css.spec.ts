import test from 'ava'
import { css } from '../index.js'

test('css()', t => {
  t.snapshot(css`
    .button {
  background-color: var(--background-color);
  &:disabled {
    background-color: var(--background-color-disabled);
  }
}`)
  t.snapshot(css`
.anchor {
  color: var(--color);
  &:focus {
    color: var(--color-focus);
  }
}`)
})





// test('classNames(): falsey', t => {
//   const condtionTrue = true
//   const conditionFalse = false
//   const actual = classNames(
//     'class-1',
//     conditionFalse && 'class-2',
//     condtionTrue && 'class-3'
//   )
//   t.is(actual, 'class-1 class-3')
// })
