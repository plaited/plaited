import sinon from 'sinon'
import { debounce } from '../index.js'

describe('debounce()', () => {
  let clock: sinon.SinonFakeTimers
  beforeEach(() => {
    clock = sinon.useFakeTimers()
  })

  afterEach(() => {
    clock.restore()
  })

  test('debounces the fn', () => {
    const fn = sinon.spy()

    const debounced = debounce(fn, 100)
    debounced()

    expect(fn.notCalled).toBeTruthy()
    clock.tick(50)

    expect(fn.notCalled).toBeTruthy()
    clock.tick(100)

    expect(fn.called).toBeTruthy()
    expect(fn.getCalls().length).toBe(1)
  })
})
