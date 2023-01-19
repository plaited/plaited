import test from 'ava'
import { css } from '../index.js'

test('css()', t => {
  t.snapshot(css`
    .Button {
  --font-family: 'Nunito Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  --font-weight: 700;
  --border: 0;
  --border-radius: map(global, borderRadiuses, borderRadius32);
  --cursor: pointer;
  --display: inline-block;
  --line-height: 1;
  --box-shadow: initial;
  --background-color-disabled: initial;
  font-family: var(--font-family);
  font-weight: var(--font-weight);
  border: var(--border);
  border-radius: var(--border-radius);
  cursor: var(--cursor);
  display: var(--display);
  line-height: var(--line-height);
  color: var(--color);
  box-shadow: var(--box-shadow);
  font-size: var(--font-size);
  padding: var(--padding);
  background-color: var(--background-color);
  &:disabled {
    background-color: var(--background-color-disabled);
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
