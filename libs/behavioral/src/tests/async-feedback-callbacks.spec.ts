import { test, expect } from 'bun:test'
import { bProgram, thread, sync } from '../index.js'
import { wait } from '@plaited/utils'

test('async feedback callbacks', async () => {
  const actual: string[] = []
  const { addThreads, trigger, feedback } = bProgram()
  addThreads({
    onInit: thread(sync({ request: { type: 'init' } })),
    afterInit: thread(sync({ request: { type: 'afterInit' } })),
  })
  feedback({
    async init() {
      actual.push('init')
      await wait(100)
      trigger({ type: 'update' })
    },
    afterInit() {
      actual.push('afterInit')
    },
    update() {
      actual.push('update')
    },
  })
  trigger({ type: 'start' })
  expect(actual).toEqual(['init', 'afterInit'])
  await wait(100)
  expect(actual).toEqual(['init', 'afterInit', 'update'])
})
