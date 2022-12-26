import test from 'ava'
import sinon from 'sinon'
import { callAll } from '../index.js'

test('callAll()', t => {
  const expected = 'string'
  const firstSpy = sinon.spy()
  const secondSpy = sinon.spy()
  callAll(firstSpy, secondSpy)(expected)
  t.truthy(firstSpy.calledWith(expected))
  t.truthy((secondSpy.calledWith(expected)))
})
