import { expect, test } from 'bun:test'
import { useWorker } from 'plaited'
import { wait } from 'plaited/utils'
import sinon from 'sinon'

test('validate userWorker and bWorker utilities function as expected', async () => {
  const spy = sinon.spy()
  const worker = new Worker(`${import.meta.dir}/worker.ts`, { type: 'module' })
  const send = useWorker((evt) => spy(evt), worker)
  send({
    type: 'calculate',
    detail: { a: 9, b: 10, operation: 'multiply' },
  })
  await wait(200)
  expect(
    spy.calledWith({
      type: 'update',
      detail: 90,
    }),
  ).toBeTruthy()
})
