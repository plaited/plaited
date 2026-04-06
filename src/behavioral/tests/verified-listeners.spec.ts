import { expect, test } from 'bun:test'
import { behavioral, bSyncVerified, bThreadVerified } from 'plaited/behavioral'
import * as z from 'zod'

test('bSyncVerified: supports string listener authoring', () => {
  const sync = bSyncVerified({ waitFor: 'event' })
  const gen = sync()

  const { value, done } = gen.next()

  expect(done).toBe(false)
  expect(value && 'waitFor' in value && value.waitFor).toBe('event')
})

test('bThreadVerified: supports match listener authoring and executes with current engine semantics', () => {
  const log: string[] = []
  const { bThreads, trigger, useFeedback } = behavioral()

  bThreads.set({
    producer: bThreadVerified([bSyncVerified({ request: { type: 'task', detail: { id: 'job-1' } } })]),
    consumer: bThreadVerified([
      bSyncVerified({
        waitFor: {
          kind: 'match',
          type: 'task',
          sourceSchema: z.literal('request'),
          detailSchema: z.object({ id: z.string() }),
        },
      }),
      bSyncVerified({ request: { type: 'ack' } }),
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
