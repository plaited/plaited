import { test, expect } from 'bun:test'
import { bProgram } from '../b-program.js'
import { wait } from '../../assert/wait.js'
import { bSync } from '../b-thread.js'
test('async feedback ELEMENT_CALLBACKS', async () => {
  const actual: string[] = []
  const { bThreads, trigger, useFeedback } = bProgram()
  bThreads.set({
    onInit: bSync({ request: { type: 'init' } }),
    afterInit: bSync({ request: { type: 'afterInit' } }),
  })
  useFeedback({
    async init() {
      actual.push('init')
      await wait(100)
      trigger({ type: 'update' , detail: 'update' })
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
