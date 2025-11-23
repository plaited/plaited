import { expect, mock, test } from 'bun:test'
import { wait } from 'plaited/utils.ts'
import { useWorker } from 'plaited.ts'

test('validate userWorker and bWorker utilities function as expected', async () => {
  const spy = mock()
  const worker = new Worker(`${import.meta.dir}/worker.ts`, { type: 'module' })
  const send = useWorker((evt) => spy(evt), worker)
  send({
    type: 'calculate',
    detail: { a: 9, b: 10, operation: 'multiply' },
  })
  await wait(200)
  expect(spy).toHaveBeenCalledWith({
    type: 'update',
    detail: 90,
  })
})
