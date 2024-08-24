import { test, expect } from 'bun:test'
import { wait } from '@plaited/utils'
import sinon from 'sinon'
import { useWorker } from '../use-worker.js'
import { BPEvent } from '../../behavioral/types.js'

test('utils-worker', async () => {
  const spy = sinon.spy()

  const host = {
    trigger: (evt: BPEvent) => spy(evt),
  }

  const [send, updateWorker] = useWorker(host)
  updateWorker(`${import.meta.dir}/worker.ts`)
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
