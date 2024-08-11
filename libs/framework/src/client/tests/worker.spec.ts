import { test, expect } from 'bun:test'
import { wait } from '@plaited/utils'
import sinon from 'sinon'
import { useWorker } from '../use-worker.js'
import { BPEvent } from '../../behavioral/private-types.js'
import { PlaitedElement } from '../types.js'
import { noop } from '@plaited/utils'

test('utils-worker', async () => {
  const spy = sinon.spy()

  const host = {
    trigger: (evt: BPEvent) => spy(evt),
    addDisconnectedCallback: noop,
  } as PlaitedElement

  const msg = useWorker(host, new URL('./worker.ts', import.meta.url))

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
