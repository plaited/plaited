import sinon from 'sinon'
import { test, expect } from 'bun:test'
import { useCallAll } from '../use-call-all.ts'

test('useCallAll()', () => {
  const expected = 'string'
  const firstSpy = sinon.spy()
  const secondSpy = sinon.spy()
  useCallAll(firstSpy, secondSpy)(expected)
  expect(firstSpy.calledWith(expected)).toBe(true)
  expect(secondSpy.calledWith(expected)).toBe(true)
})
