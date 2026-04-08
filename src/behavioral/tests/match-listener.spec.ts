import { expect, test } from 'bun:test'
import { behavioral, bSync, bThread } from 'plaited/behavioral'
import * as z from 'zod'
import { onType, onTypeWithDetail } from './helpers.ts'

test('match listener: waitFor resumes thread when type and detail schema match', () => {
  const log: string[] = []
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    producer: bThread([bSync({ request: { type: 'task', detail: { id: 'job-1' } } })]),
    consumer: bThread([
      bSync({
        waitFor: {
          kind: 'match',
          type: 'task',
          sourceSchema: z.enum(['trigger', 'request', 'emit']),
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
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    producer: bThread([bSync({ request: { type: 'task', detail: { id: 101 } } })]),
    consumer: bThread([
      bSync({
        waitFor: {
          kind: 'match',
          type: 'task',
          sourceSchema: z.enum(['trigger', 'request', 'emit']),
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

test('match listener: type mismatch prevents match when source and detail would pass', () => {
  const log: string[] = []
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    producer: bThread([bSync({ request: { type: 'other', detail: { id: 'job-1' } } })]),
    consumer: bThread([
      bSync({
        waitFor: {
          kind: 'match',
          type: 'task',
          sourceSchema: z.literal('request'),
          detailSchema: z.object({ id: z.string() }),
        },
      }),
      bSync({ request: { type: 'ack' } }),
    ]),
  })

  useFeedback({
    other() {
      log.push('other')
    },
    ack() {
      log.push('ack')
    },
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['other'])
})

test('match listener: sourceSchema request accepts only requested events', () => {
  const log: string[] = []
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    producer: bThread([bSync({ request: { type: 'task', detail: { id: 'job-1' } } })]),
    consumer: bThread([
      bSync({
        waitFor: {
          kind: 'match',
          type: 'task',
          sourceSchema: z.literal('request'),
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

test('match listener: sourceSchema trigger accepts only externally triggered events', () => {
  const log: string[] = []
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    producer: bThread([bSync({ request: { type: 'task', detail: { id: 'job-1' } } })]),
    consumer: bThread([
      bSync({
        waitFor: {
          kind: 'match',
          type: 'task',
          sourceSchema: z.literal('trigger'),
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
  trigger({ type: 'task', detail: { id: 'job-1' } })

  expect(log).toEqual(['task', 'task', 'ack'])
})

test('match listener: sourceSchema can accept trigger, request, and emit', () => {
  const log: string[] = []
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    producer: bThread([bSync({ request: { type: 'task', detail: { id: 'job-1' } } })]),
    consumer: bThread([
      bSync({
        waitFor: {
          kind: 'match',
          type: 'task',
          sourceSchema: z.enum(['trigger', 'request', 'emit']),
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

test('match listener: sourceSchema emit accepts only emit-origin events', () => {
  const log: string[] = []
  const { addBThreads, trigger, emit, useFeedback } = behavioral()

  addBThreads({
    producer: bThread([bSync({ request: { type: 'task', detail: { id: 'job-1' } } })]),
    consumer: bThread([
      bSync({
        waitFor: {
          kind: 'match',
          type: 'task',
          sourceSchema: z.literal('emit'),
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
  emit({
    type: 'task',
    detail: { id: 'job-1' },
  })

  expect(log).toEqual(['task', 'task', 'ack'])
})

test('match listener: block prevents matching requested event from being selected', () => {
  const log: string[] = []
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    blocker: bThread([
      bSync({
        block: {
          kind: 'match',
          type: 'task',
          sourceSchema: z.literal('request'),
          detailSchema: z.object({ id: z.string() }),
        },
      }),
    ]),
    taskProducer: bThread([bSync({ request: { type: 'task', detail: { id: 'job-1' } } })]),
    safeProducer: bThread([bSync({ request: { type: 'safe' } })]),
    safeFollower: bThread([bSync({ waitFor: onType('safe') }), bSync({ request: { type: 'safe_ack' } })]),
    taskFollower: bThread([bSync({ waitFor: onType('task') }), bSync({ request: { type: 'task_ack' } })]),
  })

  useFeedback({
    task() {
      log.push('task')
    },
    safe() {
      log.push('safe')
    },
    safe_ack() {
      log.push('safe_ack')
    },
    task_ack() {
      log.push('task_ack')
    },
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['safe', 'safe_ack'])
})

test('match listener: interrupt terminates thread when matching event is selected', () => {
  const log: string[] = []
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    interruptedThread: bThread([
      bSync({
        waitFor: onType('start'),
        interrupt: {
          kind: 'match',
          type: 'kill',
          sourceSchema: z.literal('request'),
          detailSchema: z.object({ id: z.literal('victim') }),
        },
      }),
      bSync({ request: { type: 'after_start' } }),
    ]),
    interruptProducer: bThread([bSync({ request: { type: 'kill', detail: { id: 'victim' } } })]),
  })

  useFeedback({
    kill() {
      log.push('kill')
    },
    after_start() {
      log.push('after_start')
    },
  })

  trigger({ type: 'kickoff' })
  trigger({ type: 'start' })

  expect(log).toEqual(['kill'])
})

test('match listener: detail-schema listeners can express conditional matching', () => {
  const log: string[] = []
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    producer: bThread([bSync({ request: { type: 'task', detail: { ok: true } } })]),
    consumer: bThread([
      bSync({
        waitFor: onTypeWithDetail({
          type: 'task',
          detailSchema: z.object({ ok: z.literal(true) }),
        }),
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
