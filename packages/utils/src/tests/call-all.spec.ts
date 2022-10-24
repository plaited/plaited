import { assert } from '@esm-bundle/chai'
import sinon from 'sinon'
import { callAll } from '../'

it('callAll()', () => {
  const expected = 'string'
  const firstSpy = sinon.spy()
  const secondSpy = sinon.spy()
  callAll(firstSpy, secondSpy)(expected)
  assert.isOk(firstSpy.calledWith(expected))
  assert.isOk((secondSpy.calledWith(expected)))
})
