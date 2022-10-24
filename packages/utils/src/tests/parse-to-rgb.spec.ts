import { assert } from '@esm-bundle/chai'
import { parseToRgb } from '../'

describe('parseToRgb()', () => {
  it('improper hex', () => {
    assert.equal(parseToRgb('8A99A8'), undefined)
  })
  it('six digits', () => {
    assert.equal(parseToRgb('#8A99A8'), 'rgb(138,153,168)')
  })
  it('eight digits', () => {
    assert.equal(parseToRgb('#8A99A80A'), 'rgba(138,153,168,0.04)')
  })
})
