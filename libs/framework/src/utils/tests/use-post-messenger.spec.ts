import { test, expect } from 'bun:test'
import { wait } from '@plaited/utils'
import sinon from 'sinon'
import { useWorker } from '../../utils.js'

test('usePostMessage', async () => {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
  })
  const msg = useWorker(worker)
  const spy = sinon.spy()
  msg.connect(spy, ['update'])

  msg({
    type: 'calculate',
    detail: { a: 9, b: 10, operation: 'multiply' },
  })
  await wait(200)
  expect({})
  expect(
    spy.calledWith({
      type: 'update',
      detail: 90,
    }),
  ).toBeTruthy()
})
