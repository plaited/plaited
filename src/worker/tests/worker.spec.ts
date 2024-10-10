import { test, expect } from 'bun:test'
import { wait } from '../../utils/wait.js'
import sinon from 'sinon'
import { useWorker } from '../use-worker.js'
import type { BPEvent } from '../../behavioral/b-thread.js'

test('userWorker|defineWorker: send and receive', async () => {
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
