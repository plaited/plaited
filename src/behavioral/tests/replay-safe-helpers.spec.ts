import { expect, test } from 'bun:test'
import { behavioral, bSyncReplaySafe, bThreadReplaySafe } from 'plaited/behavioral'
import * as z from 'zod'

test('bSyncReplaySafe: supports static request authoring', () => {
  const sync = bSyncReplaySafe({ request: { type: 'event', detail: { id: 'static' } } })
  const gen = sync()

  const { value, done } = gen.next()

  expect(done).toBe(false)
  expect(value && 'request' in value && value.request).toEqual({ type: 'event', detail: { id: 'static' } })
})

test('bSyncReplaySafe: supports string listener authoring', () => {
  const sync = bSyncReplaySafe({ waitFor: 'event' })
  const gen = sync()

  const { value, done } = gen.next()

  expect(done).toBe(false)
  expect(value && 'waitFor' in value && value.waitFor).toBe('event')
})

test('bThreadReplaySafe: supports match listener authoring and executes with current engine semantics', () => {
  const log: string[] = []
  const { bThreads, trigger, useFeedback } = behavioral()

  bThreads.set({
    producer: bThreadReplaySafe([bSyncReplaySafe({ request: { type: 'task', detail: { id: 'job-1' } } })]),
    consumer: bThreadReplaySafe([
      bSyncReplaySafe({
        waitFor: {
          kind: 'match',
          type: 'task',
          sourceSchema: z.literal('request'),
          detailSchema: z.object({ id: z.string() }),
        },
      }),
      bSyncReplaySafe({ request: { type: 'ack' } }),
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

test('bThreadReplaySafe: supports repeat true with interrupt lifetime control', () => {
  const log: string[] = []
  const { bThreads, trigger, useFeedback } = behavioral()

  bThreads.set({
    loopingResponder: bThreadReplaySafe(
      [bSyncReplaySafe({ waitFor: 'tick', interrupt: 'stop' }), bSyncReplaySafe({ request: { type: 'pong' } })],
      true,
    ),
  })

  useFeedback({
    pong() {
      log.push('pong')
    },
  })

  trigger({ type: 'tick' })
  trigger({ type: 'tick' })
  trigger({ type: 'stop' })
  trigger({ type: 'tick' })

  expect(log).toEqual(['pong', 'pong'])
})
