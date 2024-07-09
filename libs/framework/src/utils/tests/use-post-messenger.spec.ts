import { test, expect } from 'bun:test'
import { wait } from '../../utils.js'
import sinon from 'sinon'
import { useWorker } from '../../utils-client.js'

test('usePostMessage', async () => {
  const msg = useWorker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
  })
  const spy = sinon.spy()
  msg.connect(spy)

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
