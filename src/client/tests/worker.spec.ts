import { test, expect } from 'bun:test'
import { wait } from '../../assert/wait.js'
import sinon from 'sinon'
import { useWorker } from '../use-worker.js'
import { BPEvent } from '../../behavioral.js'

test('userWorker|defineWorker: send and receive', async () => {
  const spy = sinon.spy()
  const host = {
    trigger: (evt: BPEvent) => spy(evt),
  }
  const send = useWorker(host, `${import.meta.dir}/worker.ts`)
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
