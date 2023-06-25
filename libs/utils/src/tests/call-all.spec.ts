import sinon from 'sinon'
import { test, expect } from'@jest/globals'
import { callAll } from '../index.js'

test('callAll()', () => {
  const expected = 'string'
  const firstSpy = sinon.spy()
  const secondSpy = sinon.spy()
  callAll(firstSpy, secondSpy)(expected)
  expect(firstSpy.calledWith(expected)).toBe(true)
  expect(secondSpy.calledWith(expected)).toBe(true)
})
