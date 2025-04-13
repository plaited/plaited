import { test, expect } from 'bun:test'
import { wait } from 'plaited/utils'
import sinon from 'sinon'
import { useWorker } from 'plaited'
import type { BPEvent } from 'plaited/behavioral'

test('validate userWorker and defineWorker utilities function as expected', async () => {
  const spy = sinon.spy()
  const send = useWorker((evt: BPEvent) => spy(evt), `${import.meta.dir}/worker.ts`)
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
