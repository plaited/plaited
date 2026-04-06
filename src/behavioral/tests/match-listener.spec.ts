import { expect, test } from 'bun:test'
import { behavioral, bSync, bThread } from 'plaited/behavioral'
import * as z from 'zod'

test('match listener: waitFor resumes thread when type and detail schema match', () => {
  const log: string[] = []
  const { bThreads, trigger, useFeedback } = behavioral()

  bThreads.set({
    producer: bThread([bSync({ request: { type: 'task', detail: { id: 'job-1' } } })]),
    consumer: bThread([
      bSync({
        waitFor: {
          kind: 'match',
          type: 'task',
          detailSchema: z.object({ id: z.string() }),
        },
      }),
      bSync({ request: { type: 'ack' } }),
    ]),
  })

  useFeedback({
    task() {
      log.push('task')
    },
    ack() {
      log.push('ack')
    },
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task', 'ack'])
})

test('match listener: waitFor does not resume when detail schema fails', () => {
  const log: string[] = []
  const { bThreads, trigger, useFeedback } = behavioral()

  bThreads.set({
    producer: bThread([bSync({ request: { type: 'task', detail: { id: 101 } } })]),
    consumer: bThread([
      bSync({
        waitFor: {
          kind: 'match',
          type: 'task',
          detailSchema: z.object({ id: z.string() }),
        },
      }),
      bSync({ request: { type: 'ack' } }),
    ]),
  })

  useFeedback({
    task() {
      log.push('task')
    },
    ack() {
      log.push('ack')
    },
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task'])
})

test('match listener: predicate listeners still work unchanged', () => {
  const log: string[] = []
  const { bThreads, trigger, useFeedback } = behavioral()

  bThreads.set({
    producer: bThread([bSync({ request: { type: 'task', detail: { ok: true } } })]),
    consumer: bThread([
      bSync({
        waitFor: (event) => event.type === 'task' && event.detail?.ok === true,
      }),
      bSync({ request: { type: 'ack' } }),
    ]),
  })

  useFeedback({
    task() {
      log.push('task')
    },
    ack() {
      log.push('ack')
    },
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task', 'ack'])
})
