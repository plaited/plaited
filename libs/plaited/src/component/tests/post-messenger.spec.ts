import { test } from '@plaited/rite'
import sinon from 'sinon'
import { usePostMessageClient } from '../utils.js'

test('messenger: with worker', async (t) => {
  const worker = new Worker(new URL('/src/component/tests/__mocks__/test.worker.ts', import.meta.url), {
    type: 'module',
  })
  const msg = usePostMessageClient(worker)
  const spy = sinon.spy()
  msg.connect(spy, ['update'])

  msg({
    type: 'calculate',
    detail: { a: 9, b: 10, operation: 'multiply' },
  })
  await t.wait(200)
  t({
    given: 'requesting calculate',
    should: 'update with value',
    actual: spy.calledWith({
      type: 'update',
      detail: 90,
    }),
    expected: true,
  })
})
