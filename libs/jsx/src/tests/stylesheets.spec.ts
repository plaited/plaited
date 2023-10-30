import { test, expect } from'bun:test'
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

test('stylesheets', () => {
  expect(stylesheets(sheet1[1], sheet3[1])).toEqual({ stylesheet: [ '.a_NTA5Nj { width: 100%; }', '.a_LTIzMT { color: blue; }' ] })
  const conditionTrue = true
  const conditionFalse = false
  expect(stylesheets(
    sheet1[1],
    conditionFalse && sheet2[1],
    conditionTrue && sheet3[1]
  )).toEqual({ stylesheet: [ '.a_NTA5Nj { width: 100%; }', '.a_LTIzMT { color: blue; }' ] })
})
