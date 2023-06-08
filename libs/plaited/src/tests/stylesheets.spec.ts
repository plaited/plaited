import { test } from '@plaited/rite'
import { stylesheets, css } from '../index.js'

const sheet1 = css`
  .a {
    width: 100%;
  }
`
const sheet2 = css`
  .a {
    height: 100%;
  }
`

const sheet3 = css`
.a {
  color: blue;
}
`

test('stylesheets', t => {
  t({
    given: 'two stylesheet objects ',
    should: 'join them',
    expected:  { stylesheet: [ '.a_NTA5Nj { width: 100%; }', '.a_LTIzMT { color: blue; }' ] },
    actual: stylesheets(sheet1[1], sheet3[1]),
  })
  const conditionTrue = true
  const conditionFalse = false
  t({
    given: 'truthy and falsy stylesheet objects',
    should: 'join only truthy',
    expected:  { stylesheet: [ '.a_NTA5Nj { width: 100%; }', '.a_LTIzMT { color: blue; }' ] },
    actual: stylesheets(
      sheet1[1],
      conditionFalse && sheet2[1],
      conditionTrue && sheet3[1]
    ),
  })
})
