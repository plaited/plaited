import { expect, test } from 'bun:test'
import sinon from 'sinon'
import { publisher } from '../index.js'

test('publisher()', () => {
  const pub = publisher<number>()
  const callback = sinon.spy()
  const disconnect = pub.subscribe(callback)
  pub(1)
  expect(callback.args).toEqual([[1]])
  pub(3)
  expect(callback.args).toEqual([[1], [3]])
  expect(callback.callCount).toEqual(2)
  disconnect()
  pub(7)
  expect(callback.callCount).toEqual(2)
})
