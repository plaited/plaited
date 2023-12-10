import { test, expect } from 'bun:test'
import { css } from '../index.js'
import { stylesheets } from '../utils.js'

const { $stylesheet: sheet1 } = css`
  .a {
    width: 100%;
  }
`
const { $stylesheet: sheet2 } = css`
  .a {
    height: 100%;
  }
`

const { $stylesheet: sheet3 } = css`
  .a {
    color: blue;
  }
`

const { $stylesheet: sheet4 } = css`
  .a {
    color: red;
  }
`

test('stylesheets', () => {
  expect(stylesheets(sheet1, sheet3)).toEqual(['.a_NTA5Nj { width: 100%; }', '.a_LTIzMT { color: blue; }'])
  expect(stylesheets(undefined && sheet1, false && sheet2, null && sheet3, sheet4)).toEqual([
    '.a_MjMzNz { color: red; }',
  ])
})
