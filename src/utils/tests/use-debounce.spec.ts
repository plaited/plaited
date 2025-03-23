import sinon from 'sinon'
import { test, expect, beforeEach, afterEach } from 'bun:test'
import { useDebounce } from 'plaited/utils'

let clock: sinon.SinonFakeTimers

beforeEach(() => {
  clock = sinon.useFakeTimers()
})
afterEach(() => {
  clock.restore()
})

test('useDebounce()', () => {
  const fn = sinon.spy()

  const useDebounced = useDebounce(fn, 100)
  useDebounced()

  expect(fn.notCalled).toBe(true)
  clock.tick(50)

  expect(fn.notCalled).toBe(true)
  clock.tick(100)

  expect(fn.called).toBe(true)
  expect(fn.getCalls().length).toBe(1)
})
